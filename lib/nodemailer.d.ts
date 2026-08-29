declare module 'nodemailer' {
  export interface Transporter {
    sendMail(options: Record<string, unknown>): Promise<unknown>;
    verify(): Promise<true>;
  }

  export function createTransport(options: Record<string, unknown>): Transporter;

  const nodemailer: {
    createTransport: typeof createTransport;
  };
  export default nodemailer;
}
