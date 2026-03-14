export type RoomSummary = {
  roomId: string;
  name: string;
  topic?: string;
  encrypted: boolean;
  lastTs: number;
};

export type TimelineMessage = {
  id: string;
  roomId: string;
  sender: string;
  body: string;
  ts: number;
  ai?: boolean;
};

export type MatrixSession = {
  baseUrl: string;
  accessToken: string;
  userId: string;
  deviceId?: string;
};
