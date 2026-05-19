declare module "twilio" {
  export default function Twilio(accountSid: string, authToken: string): {
    messages: {
      create(params: { to: string; from: string; body: string; }): Promise<{ sid: string }>;
    };
  };
  export const VoiceClient: any;
}
