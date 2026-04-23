import { Sample } from "../types/Sample";

export const mockSamples: Record<string, Sample[]> = {
  popular: [
    {
      id: "popular-1",
      authorId: "u1",
      author: "@southkid",
      title: "Lo-Fi Dreams",
      tags: ["lofi", "chill", "ambient"],
      audioUrl: "/audio/ALL EYES ON ME CHOP.wav",
      time: "0:32",
      key: "Am",
      bpm: 85,
      type: "Loop",
      price: 50,
      jsonPeaksUrl: "/waveforms/ALL EYES ON ME CHOP.json"
    },
    {
      id: "popular-3",
      authorId: "u3",
      author: "@bagamemphis",
      collaboratorIds: ["u2", "u8"],
      title: "Lo-Fi Dreams",
      tags: ["lofi", "chill", "ambient"],
      audioUrl: "/audio/ALL EYES ON ME CHOP.wav",
      time: "0:32",
      key: "Am",
      bpm: 85,
      type: "Loop",
      price: 50,
      jsonPeaksUrl: "/waveforms/ALL EYES ON ME CHOP.json"
    },
    {
      id: "popular-4",
      authorId: "u3",
      author: "@bagamemphis",
      collaboratorIds: ["u1"],
      title: "Lo-Fi Dreams",
      tags: ["lofi", "chill", "ambient"],
      audioUrl: "/audio/ALL EYES ON ME CHOP.wav",
      time: "0:32",
      key: "Am",
      bpm: 85,
      type: "Loop",
      price: 50,
      jsonPeaksUrl: "/waveforms/ALL EYES ON ME CHOP.json"
    },
    {
      id: "popular-5",
      authorId: "u4",
      author: "@vhsghost",
      collaboratorIds: ["u5", "u2"],
      title: "Lo-Fi Dreams",
      tags: ["lofi", "chill", "ambient"],
      audioUrl: "/audio/ALL EYES ON ME CHOP.wav",
      time: "0:32",
      key: "Am",
      bpm: 85,
      type: "Loop",
      price: 50,
      jsonPeaksUrl: "/waveforms/ALL EYES ON ME CHOP.json"
    },
    {
      id: "popular-6",
      authorId: "u1",
      author: "@southkid",
      collaboratorIds: ["u6"],
      title: "Lo-Fi Dreams",
      tags: ["lofi", "chill", "ambient"],
      audioUrl: "/audio/ALL EYES ON ME CHOP.wav",
      time: "0:32",
      key: "Am",
      bpm: 85,
      type: "Loop",
      price: 50,
      jsonPeaksUrl: "/waveforms/ALL EYES ON ME CHOP.json"
    },
    {
      id: "popular-2",
      authorId: "u2",
      author: "@squaredealer",
      collaboratorIds: ["u7"],
      title: "Retro Vibes",
      tags: ["retro", "synth", "80s"],
      audioUrl: "/audio/BULLET CHOP.wav",
      time: "0:45",
      key: "Dm",
      bpm: 120,
      type: "One-shot",
      price: 75,
      jsonPeaksUrl: "/waveforms/BULLET CHOP.json"
    }
  ],
  premium: [
    {
      id: "premium-1",
      authorId: "u5",
      author: "@astralchild",
      collaboratorIds: ["u1"],
      title: "alesha_popovich_type_beat_nowrap",
      tags: ["lofi", "chill", "ambient"],
      audioUrl: "/audio/ALL EYES ON ME CHOP.wav",
      time: "0:32",
      key: "Am",
      bpm: 85,
      type: "Loop",
      price: 150,
      jsonPeaksUrl: "/waveforms/ALL EYES ON ME CHOP.json"
    },
    {
      id: "premium-2",
      authorId: "u2",
      author: "@squaredealer",
      collaboratorIds: ["u5"],
      title: "VIP Sample",
      tags: ["retro", "synth", "80s"],
      audioUrl: "/audio/BULLET CHOP.wav",
      time: "0:45",
      key: "Dm",
      bpm: 120,
      type: "One-shot",
      price: 200,
      jsonPeaksUrl: "/waveforms/BULLET CHOP.json"
    }
  ],
  liked: [
    {
      id: "liked-1",
      authorId: "u6",
      author: "@caldera",
      title: "Favorite Track",
      tags: ["lofi", "chill", "ambient"],
      audioUrl: "/audio/ALL EYES ON ME CHOP.wav",
      time: "0:32",
      key: "Am",
      bpm: 85,
      type: "Loop",
      price: 50,
      jsonPeaksUrl: "/waveforms/ALL EYES ON ME CHOP.json"
    },
    {
      id: "liked-2",
      authorId: "u7",
      author: "@andrezj",
      collaboratorIds: ["u2", "u3"],
      title: "Saved Beat",
      tags: ["retro", "synth", "80s"],
      audioUrl: "/audio/BULLET CHOP.wav",
      time: "0:45",
      key: "Dm",
      bpm: 120,
      type: "One-shot",
      price: 75,
      jsonPeaksUrl: "/waveforms/BULLET CHOP.json"
    }
  ]
};
