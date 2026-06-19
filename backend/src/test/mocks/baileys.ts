const makeWASocket = () => ({
  ev: {
    on: () => undefined
  },
  end: () => undefined,
  logout: async () => undefined,
  sendMessage: async () => ({ key: { id: "mock-id" } }),
  groupFetchAllParticipating: async () => ({})
});

export const Browsers = {
  macOS: (_name: string) => "mock-browser"
};

export const DisconnectReason = {
  loggedOut: 401
};

export const fetchLatestBaileysVersion = async () => ({
  version: [2, 3000, 0]
});

export default makeWASocket;
