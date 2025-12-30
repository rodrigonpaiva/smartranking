type BetterAuthOptions = Record<string, unknown>;

type Handler = (req: unknown, res: unknown) => void;

const noopHandler: Handler = (_req, res) => {
  if (res && typeof (res as { status: (code: number) => unknown }).status === 'function') {
    (res as { status: (code: number) => { end: () => void } }).status(200).end();
    return;
  }
  if (res && typeof (res as { end: () => void }).end === 'function') {
    (res as { end: () => void }).end();
  }
};

export const betterAuth = (options: BetterAuthOptions) => {
  return {
    options,
    handler: noopHandler,
  };
};
