// Copyright 2017-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { join } from 'path';
import {
  BrowserWindow,
  Menu,
  NativeImage,
  Tray,
  app,
  nativeImage,
} from 'electron';
import * as log from '../ts/logging/log';
import type { LocaleMessagesType } from '../ts/types/I18N';

/**
 * A class that manages an [Electron `Tray` instance][0]. It's responsible for creating
 * and destroying a `Tray`, and listening to the associated `BrowserWindow`'s visibility
 * state.
 *
 * [0]: https://www.electronjs.org/docs/api/tray
 */
export class SystemTrayService {
  private browserWindow?: BrowserWindow;

  private readonly messages: LocaleMessagesType;

  private tray?: Tray;

  private isEnabled = false;

  private unreadCount = 0;

  private boundRender: typeof SystemTrayService.prototype.render;

  constructor({ messages }: Readonly<{ messages: LocaleMessagesType }>) {
    log.info('System tray service: created');
    this.messages = messages;
    this.boundRender = this.render.bind(this);
  }

  /**
   * Update or clear the associated `BrowserWindow`. This is used for the hide/show
   * functionality. It attaches event listeners to the window to manage the hide/show
   * toggle in the tray's context menu.
   */
  setMainWindow(newBrowserWindow: undefined | BrowserWindow): void {
    const oldBrowserWindow = this.browserWindow;
    if (oldBrowserWindow === newBrowserWindow) {
      return;
    }

    log.info(
      `System tray service: updating main window. Previously, there was ${
        oldBrowserWindow ? '' : 'not '
      }a window, and now there is${newBrowserWindow ? '' : ' not'}`
    );

    if (oldBrowserWindow) {
      oldBrowserWindow.off('show', this.boundRender);
      oldBrowserWindow.off('hide', this.boundRender);
    }

    if (newBrowserWindow) {
      newBrowserWindow.on('show', this.boundRender);
      newBrowserWindow.on('hide', this.boundRender);
    }

    this.browserWindow = newBrowserWindow;

    this.render();
  }

  /**
   * Enable or disable the tray icon. Note: if there is no associated browser window (see
   * `setMainWindow`), the tray icon will not be shown, even if enabled.
   */
  setEnabled(isEnabled: boolean): void {
    if (this.isEnabled === isEnabled) {
      return;
    }

    log.info(`System tray service: ${isEnabled ? 'enabling' : 'disabling'}`);
    this.isEnabled = isEnabled;
    this.render();
  }

  /**
   * Update the unread count, which updates the tray icon if it's visible.
   */
  setUnreadCount(unreadCount: number): void {
    if (this.unreadCount === unreadCount) {
      return;
    }

    log.info(`System tray service: setting unread count to ${unreadCount}`);
    this.unreadCount = unreadCount;
    this.render();
  }

  private render(): void {
    if (this.isEnabled && this.browserWindow) {
      this.renderEnabled();
      return;
    }
    this.renderDisabled();
  }

  private renderEnabled() {
    log.info('System tray service: rendering the tray');

    this.tray = this.tray || this.createTray();
    const { browserWindow, tray } = this;

    try {
      tray.setImage(getIcon(this.unreadCount));
    } catch (err: unknown) {
      log.warn(
        'System tray service: failed to set preferred image. Falling back...'
      );
      tray.setImage(getDefaultIcon());
    }

    // NOTE: we want to have the show/hide entry available in the tray icon
    // context menu, since the 'click' event may not work on all platforms.
    // For details please refer to:
    // https://github.com/electron/electron/blob/master/docs/api/tray.md.
    tray.setContextMenu(
      Menu.buildFromTemplate([
        {
          id: 'toggleWindowVisibility',
          ...(browserWindow?.isVisible()
            ? {
                label: this.messages.hide.message,
                click: () => {
                  log.info(
                    'System tray service: hiding the window from the context menu'
                  );
                  // We re-fetch `this.browserWindow` here just in case the browser window
                  //   has changed while the context menu was open. Same applies in the
                  //   "show" case below.
                  this.browserWindow?.hide();
                },
              }
            : {
                label: this.messages.show.message,
                click: () => {
                  log.info(
                    'System tray service: showing the window from the context menu'
                  );
                  if (this.browserWindow) {
                    this.browserWindow.show();
                    forceOnTop(this.browserWindow);
                  }
                },
              }),
        },
        {
          id: 'quit',
          label: this.messages.quit.message,
          click: () => {
            log.info(
              'System tray service: quitting the app from the context menu'
            );
            app.quit();
          },
        },
      ])
    );
  }

  private renderDisabled() {
    log.info('System tray service: rendering no tray');

    if (!this.tray) {
      return;
    }
    this.tray.destroy();
    this.tray = undefined;
  }

  private createTray(): Tray {
    log.info('System tray service: creating the tray');

    // This icon may be swiftly overwritten.
    const result = new Tray(getDefaultIcon());

    // Note: "When app indicator is used on Linux, the click event is ignored." This
    //   doesn't mean that the click event is always ignored on Linux; it depends on how
    //   the app indicator is set up.
    //
    // See <https://github.com/electron/electron/blob/v13.1.3/docs/api/tray.md#class-tray>.
    result.on('click', () => {
      const { browserWindow } = this;
      if (!browserWindow) {
        return;
      }
      if (!browserWindow.isVisible()) {
        browserWindow.show();
      }
      forceOnTop(browserWindow);
    });

    result.setToolTip(this.messages.signalDesktop.message);

    return result;
  }

  /**
   * This is exported for testing, because Electron doesn't have any easy way to hook
   * into the existing tray instances. It should not be used by "real" code.
   */
  _getTray(): undefined | Tray {
    return this.tray;
  }
}

function getIcon(unreadCount: number) {
  let iconSize: string;
  switch (process.platform) {
    case 'darwin':
      iconSize = '16';
      break;
    case 'win32':
      iconSize = '32';
      break;
    default:
      iconSize = '256';
      break;
  }

  if (unreadCount > 0) {
    const filename = `${String(unreadCount >= 10 ? 10 : unreadCount)}.png`;
    return join(__dirname, '..', 'images', 'alert', iconSize, filename);
  }

  return join(__dirname, '..', 'images', `icon_${iconSize}.png`);
}

let defaultIcon: undefined | NativeImage;
function getDefaultIcon(): NativeImage {
  defaultIcon ??= nativeImage.createFromPath(getIcon(0));
  return defaultIcon;
}

function forceOnTop(browserWindow: BrowserWindow) {
  // On some versions of GNOME the window may not be on top when restored.
  // This trick should fix it.
  // Thanks to: https://github.com/Enrico204/Whatsapp-Desktop/commit/6b0dc86b64e481b455f8fce9b4d797e86d000dc1
  browserWindow.setAlwaysOnTop(true);
  browserWindow.focus();
  browserWindow.setAlwaysOnTop(false);
}
