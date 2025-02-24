// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { canvasToBlob } from './canvasToBlob';
import { MIMEType } from '../types/MIME';

export async function canvasToBytes(
  canvas: HTMLCanvasElement,
  mimeType?: MIMEType,
  quality?: number
): Promise<Uint8Array> {
  const blob = await canvasToBlob(canvas, mimeType, quality);
  return new Uint8Array(await blob.arrayBuffer());
}
