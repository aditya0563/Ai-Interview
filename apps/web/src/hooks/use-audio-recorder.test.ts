/**
 * apps/web — useAudioRecorder hook tests
 *
 * The browser's Web Audio / Media APIs (navigator.mediaDevices.getUserMedia,
 * MediaStream, MediaStreamTrack) are fully mocked at the vi.stubGlobal level
 * so these tests run in jsdom without any real microphone.
 *
 * Every test receives a fresh mock via beforeEach to prevent state leakage.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAudioRecorder } from "./use-audio-recorder";

// ─── Mock MediaStreamTrack ───────────────────────────────────────────────────

function makeMockTrack(): MediaStreamTrack {
  return {
    stop: vi.fn(),
    kind: "audio",
    enabled: true,
    id: crypto.randomUUID(),
    label: "Mock microphone",
    muted: false,
    readyState: "live",
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
    applyConstraints: vi.fn().mockResolvedValue(undefined),
    clone: vi.fn(),
    getCapabilities: vi.fn().mockReturnValue({}),
    getConstraints: vi.fn().mockReturnValue({}),
    getSettings: vi.fn().mockReturnValue({}),
    onended: null,
    onmute: null,
    onunmute: null,
    contentHint: "",
  } as unknown as MediaStreamTrack;
}

// ─── Mock MediaStream ────────────────────────────────────────────────────────

function makeMockStream(
  trackCount = 1
): MediaStream & { _tracks: MediaStreamTrack[] } {
  const tracks = Array.from({ length: trackCount }, makeMockTrack);
  return {
    _tracks: tracks,
    getTracks: vi.fn().mockReturnValue(tracks),
    getAudioTracks: vi.fn().mockReturnValue(tracks),
    getVideoTracks: vi.fn().mockReturnValue([]),
    addTrack: vi.fn(),
    removeTrack: vi.fn(),
    id: crypto.randomUUID(),
    active: true,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
    clone: vi.fn(),
    getTrackById: vi.fn(),
    onaddtrack: null,
    onremovetrack: null,
  } as unknown as MediaStream & { _tracks: MediaStreamTrack[] };
}

// ─── Setup / teardown ────────────────────────────────────────────────────────

let mockGetUserMedia: ReturnType<typeof vi.fn>;
let mockStream: ReturnType<typeof makeMockStream>;

beforeEach(() => {
  mockStream = makeMockStream();
  mockGetUserMedia = vi.fn().mockResolvedValue(mockStream);

  vi.stubGlobal("navigator", {
    mediaDevices: {
      getUserMedia: mockGetUserMedia,
    },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

// ═══════════════════════════════════════════════════════════════════════════
// Initial state
// ═══════════════════════════════════════════════════════════════════════════

describe("useAudioRecorder — initial state", () => {
  it("starts with isRecording=false, stream=null, error=null", () => {
    const { result } = renderHook(() => useAudioRecorder());
    expect(result.current.isRecording).toBe(false);
    expect(result.current.stream).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("exposes startRecording and stopRecording as functions", () => {
    const { result } = renderHook(() => useAudioRecorder());
    expect(typeof result.current.startRecording).toBe("function");
    expect(typeof result.current.stopRecording).toBe("function");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// startRecording — happy path
// ═══════════════════════════════════════════════════════════════════════════

describe("useAudioRecorder — startRecording (success)", () => {
  it("calls getUserMedia with { audio: true }", async () => {
    const { result } = renderHook(() => useAudioRecorder());
    await act(async () => {
      await result.current.startRecording();
    });
    expect(mockGetUserMedia).toHaveBeenCalledOnce();
    expect(mockGetUserMedia).toHaveBeenCalledWith({ audio: true });
  });

  it("sets isRecording=true after a successful getUserMedia call", async () => {
    const { result } = renderHook(() => useAudioRecorder());
    await act(async () => {
      await result.current.startRecording();
    });
    expect(result.current.isRecording).toBe(true);
  });

  it("sets stream to the returned MediaStream", async () => {
    const { result } = renderHook(() => useAudioRecorder());
    await act(async () => {
      await result.current.startRecording();
    });
    expect(result.current.stream).toBe(mockStream);
  });

  it("clears any previous error on a successful start", async () => {
    // First, force an error
    mockGetUserMedia.mockRejectedValueOnce(
      new DOMException("Denied", "NotAllowedError")
    );
    const { result } = renderHook(() => useAudioRecorder());
    await act(async () => {
      await result.current.startRecording();
    });
    expect(result.current.error).not.toBeNull();

    // Now succeed — error should be cleared
    mockGetUserMedia.mockResolvedValueOnce(makeMockStream());
    await act(async () => {
      await result.current.startRecording();
    });
    expect(result.current.error).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// startRecording — error path
// ═══════════════════════════════════════════════════════════════════════════

describe("useAudioRecorder — startRecording (errors)", () => {
  it("sets a human-readable error for NotAllowedError", async () => {
    mockGetUserMedia.mockRejectedValueOnce(
      new DOMException("Permission denied by user", "NotAllowedError")
    );
    const { result } = renderHook(() => useAudioRecorder());
    await act(async () => {
      await result.current.startRecording();
    });
    expect(result.current.error).toBe("Microphone permission was denied.");
    expect(result.current.isRecording).toBe(false);
    expect(result.current.stream).toBeNull();
  });

  it("surfaces the DOMException message for other DOMExceptions", async () => {
    const errorMessage = "Requested device not found";
    mockGetUserMedia.mockRejectedValueOnce(
      new DOMException(errorMessage, "NotFoundError")
    );
    const { result } = renderHook(() => useAudioRecorder());
    await act(async () => {
      await result.current.startRecording();
    });
    expect(result.current.error).toBe(errorMessage);
    expect(result.current.isRecording).toBe(false);
  });

  it("sets generic fallback error for non-DOMException throws", async () => {
    mockGetUserMedia.mockRejectedValueOnce(new Error("Unknown OS error"));
    const { result } = renderHook(() => useAudioRecorder());
    await act(async () => {
      await result.current.startRecording();
    });
    expect(result.current.error).toBe("Unable to access the microphone.");
    expect(result.current.isRecording).toBe(false);
  });

  it("sets generic fallback error for thrown non-Error values", async () => {
    mockGetUserMedia.mockRejectedValueOnce("just a string");
    const { result } = renderHook(() => useAudioRecorder());
    await act(async () => {
      await result.current.startRecording();
    });
    expect(result.current.error).toBe("Unable to access the microphone.");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// stopRecording
// ═══════════════════════════════════════════════════════════════════════════

describe("useAudioRecorder — stopRecording", () => {
  it("sets isRecording=false after stopping an active recording", async () => {
    const { result } = renderHook(() => useAudioRecorder());
    await act(async () => {
      await result.current.startRecording();
    });
    expect(result.current.isRecording).toBe(true);

    act(() => {
      result.current.stopRecording();
    });
    expect(result.current.isRecording).toBe(false);
  });

  it("sets stream to null after stopping", async () => {
    const { result } = renderHook(() => useAudioRecorder());
    await act(async () => {
      await result.current.startRecording();
    });
    expect(result.current.stream).not.toBeNull();

    act(() => {
      result.current.stopRecording();
    });
    expect(result.current.stream).toBeNull();
  });

  it("calls track.stop() on every track in the stream", async () => {
    const multiTrackStream = makeMockStream(3);
    mockGetUserMedia.mockResolvedValueOnce(multiTrackStream);

    const { result } = renderHook(() => useAudioRecorder());
    await act(async () => {
      await result.current.startRecording();
    });
    act(() => {
      result.current.stopRecording();
    });

    for (const track of multiTrackStream._tracks) {
      expect(track.stop).toHaveBeenCalledOnce();
    }
  });

  it("is a no-op when called before startRecording", () => {
    const { result } = renderHook(() => useAudioRecorder());
    // Should not throw and state stays unchanged
    act(() => {
      result.current.stopRecording();
    });
    expect(result.current.isRecording).toBe(false);
    expect(result.current.stream).toBeNull();
  });

  it("is safe to call multiple times consecutively", async () => {
    const { result } = renderHook(() => useAudioRecorder());
    await act(async () => {
      await result.current.startRecording();
    });
    act(() => {
      result.current.stopRecording();
      result.current.stopRecording();
    });
    expect(result.current.isRecording).toBe(false);
    expect(result.current.stream).toBeNull();
    // Each track.stop() still called only once (stream was nulled after first call)
    for (const track of mockStream._tracks) {
      expect(track.stop).toHaveBeenCalledOnce();
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Unmount cleanup (useEffect teardown)
// ═══════════════════════════════════════════════════════════════════════════

describe("useAudioRecorder — cleanup on unmount", () => {
  it("stops all tracks when the component unmounts during recording", async () => {
    const { result, unmount } = renderHook(() => useAudioRecorder());
    await act(async () => {
      await result.current.startRecording();
    });

    unmount();

    for (const track of mockStream._tracks) {
      expect(track.stop).toHaveBeenCalled();
    }
  });

  it("does not throw when unmounting without ever recording", () => {
    const { unmount } = renderHook(() => useAudioRecorder());
    expect(() => unmount()).not.toThrow();
  });
});
