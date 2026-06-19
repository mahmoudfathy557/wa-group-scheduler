export const SEND_GATEWAY = Symbol("SEND_GATEWAY");

export interface SendParams {
  tenantId: string;
  groupJid: string;
  messageText: string;
  imageUrls: string[];
  /** Fan-out index — 0 means first message; jitter is skipped for it. */
  index: number;
}

export interface ISendGateway {
  /**
   * Apply anti-ban jitter (skipped for index 0) then dispatch the message
   * through the underlying transport (Baileys).
   *
   * @returns WhatsApp message ID, or null if the transport did not return one.
   */
  sendWithJitter(params: SendParams): Promise<string | null>;

  /** Returns true when the underlying WA session is ready to send. */
  isConnected(tenantId: string): boolean;
}
