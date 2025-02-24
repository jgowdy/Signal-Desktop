// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import classNames from 'classnames';

import { Tooltip } from './Tooltip';
import { LocalizerType } from '../types/Util';

type PropsType = {
  className?: string;
  tooltipContainerRef?: React.RefObject<HTMLElement>;
  i18n: LocalizerType;
};

export const InContactsIcon = (props: PropsType): JSX.Element => {
  const { className, i18n, tooltipContainerRef } = props;

  /* eslint-disable jsx-a11y/no-noninteractive-tabindex */
  return (
    <Tooltip
      content={i18n('contactInAddressBook')}
      popperModifiers={[
        {
          name: 'preventOverflow',
          options: {
            boundary: tooltipContainerRef?.current || undefined,
          },
        },
      ]}
    >
      <span
        aria-label={i18n('contactInAddressBook')}
        className={classNames('module-in-contacts-icon__icon', className)}
        role="img"
        tabIndex={0}
      />
    </Tooltip>
  );
  /* eslint-enable jsx-a11y/no-noninteractive-tabindex */
};
