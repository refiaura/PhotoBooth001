import type { IceServer } from "./api";
import type { RtcSignal } from "./realtime";

/** Preview cukup ringan: foto akhir diambil dari kamera lokal, bukan dari stream ini. */
const PREVIEW_MAX_BITRATE = 600_000;

/**
 * Koneksi WebRTC P2P untuk preview pasangan.
 *
 * Hanya host (initiator) yang membuat offer; tamu membuat PeerLink saat offer tiba lalu
 * menjawab. Dengan satu arah negosiasi, offer tidak bisa saling bertabrakan atau hilang
 * karena sisi lain belum siap. Kandidat ICE yang tiba sebelum remote description diantrikan.
 */
export class PeerLink {
  private readonly pc: RTCPeerConnection;
  private readonly pendingCandidates: RTCIceCandidateInit[] = [];
  private closed = false;

  constructor(
    private readonly options: {
      iceServers: IceServer[];
      initiator: boolean;
      localStream: MediaStream;
      send: (signal: Omit<RtcSignal, "from">) => void;
      onRemoteStream: (stream: MediaStream) => void;
      onConnectionState: (state: RTCPeerConnectionState) => void;
    },
  ) {
    this.pc = new RTCPeerConnection({ iceServers: options.iceServers });

    this.pc.ontrack = ({ streams }) => {
      if (streams[0]) options.onRemoteStream(streams[0]);
    };
    this.pc.onicecandidate = ({ candidate }) => {
      if (candidate) options.send({ candidate: candidate.toJSON() });
    };
    this.pc.onnegotiationneeded = async () => {
      if (!options.initiator || this.closed) return;
      try {
        await this.pc.setLocalDescription();
        if (this.pc.localDescription) options.send({ description: this.pc.localDescription.toJSON() });
      } catch (err) {
        console.warn("[rtc] gagal membuat offer", err);
      }
    };
    this.pc.onconnectionstatechange = () => {
      options.onConnectionState(this.pc.connectionState);
      if (this.pc.connectionState === "failed" && options.initiator) this.pc.restartIce();
    };

    for (const track of options.localStream.getVideoTracks()) {
      const sender = this.pc.addTrack(track, options.localStream);
      void limitBitrate(sender);
    }
  }

  async handleSignal({ description, candidate }: RtcSignal) {
    if (this.closed) return;
    try {
      if (description) {
        // Initiator hanya menerima answer; tamu hanya menerima offer.
        if (this.options.initiator !== (description.type === "answer")) return;
        await this.pc.setRemoteDescription(description);
        if (description.type === "offer") {
          await this.pc.setLocalDescription();
          if (this.pc.localDescription) this.options.send({ description: this.pc.localDescription.toJSON() });
        }
        for (const c of this.pendingCandidates.splice(0)) await this.pc.addIceCandidate(c);
      } else if (candidate) {
        if (this.pc.remoteDescription) await this.pc.addIceCandidate(candidate);
        else this.pendingCandidates.push(candidate);
      }
    } catch (err) {
      console.warn("[rtc] sinyal gagal diproses", err);
    }
  }

  close() {
    this.closed = true;
    this.pc.close();
  }
}

async function limitBitrate(sender: RTCRtpSender) {
  try {
    const params = sender.getParameters();
    if (!params.encodings?.length) params.encodings = [{}];
    params.encodings[0].maxBitrate = PREVIEW_MAX_BITRATE;
    await sender.setParameters(params);
  } catch {
    // Tidak semua browser mengizinkan setParameters sebelum negosiasi; preview tetap jalan.
  }
}
