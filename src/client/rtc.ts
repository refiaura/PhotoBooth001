import type { IceServer } from "./api";
import type { RtcSignal } from "./realtime";

/** Preview cukup ringan: foto akhir diambil dari kamera lokal, bukan dari stream ini. */
const PREVIEW_MAX_BITRATE = 600_000;

/**
 * Koneksi WebRTC P2P untuk preview pasangan, memakai pola "perfect negotiation"
 * (tamu = polite, host = impolite) agar tabrakan offer dari dua sisi selesai sendiri.
 */
export class PeerLink {
  private readonly pc: RTCPeerConnection;
  private makingOffer = false;
  private ignoreOffer = false;
  private closed = false;

  constructor(
    private readonly options: {
      iceServers: IceServer[];
      polite: boolean;
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
    this.pc.onicecandidate = ({ candidate }) => options.send({ candidate: candidate?.toJSON() ?? null });
    this.pc.onnegotiationneeded = async () => {
      try {
        this.makingOffer = true;
        await this.pc.setLocalDescription();
        if (this.pc.localDescription) options.send({ description: this.pc.localDescription.toJSON() });
      } catch (err) {
        console.warn("[rtc] negosiasi gagal", err);
      } finally {
        this.makingOffer = false;
      }
    };
    this.pc.onconnectionstatechange = () => {
      options.onConnectionState(this.pc.connectionState);
      if (this.pc.connectionState === "failed") this.pc.restartIce();
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
        const collision =
          description.type === "offer" && (this.makingOffer || this.pc.signalingState !== "stable");
        this.ignoreOffer = !this.options.polite && collision;
        if (this.ignoreOffer) return;

        await this.pc.setRemoteDescription(description);
        if (description.type === "offer") {
          await this.pc.setLocalDescription();
          if (this.pc.localDescription) this.options.send({ description: this.pc.localDescription.toJSON() });
        }
      } else if (candidate) {
        try {
          await this.pc.addIceCandidate(candidate);
        } catch (err) {
          if (!this.ignoreOffer) throw err;
        }
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
