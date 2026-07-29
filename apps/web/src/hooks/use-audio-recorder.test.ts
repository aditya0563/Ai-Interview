import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { useAudioRecorder } from "./use-audio-recorder";

describe("useAudioRecorder Hook", () => {
  const originalNavigator = global.navigator;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(global, "navigator", {
      value: originalNavigator,
      writable: true,
    });
  });

  it("Test Case 1: Graceful Degradation - handles missing mediaDevices gracefully", async () => {
    // Arrange: Simulate insecure context or old browser by setting mediaDevices to undefined
    Object.defineProperty(global, "navigator", {
      value: {
        mediaDevices: undefined,
      },
      writable: true,
    });

    const { result } = renderHook(() => useAudioRecorder());

    // Act
    await act(async () => {
      await result.current.startRecording();
    });

    // Assert: Verify it did not throw an unhandled crash and set the expected error
    expect(result.current.isRecording).toBe(false);
    expect(result.current.error).toBe(
      "Microphone access is unavailable. Please ensure you are using HTTPS and a modern browser."
    );
    expect(result.current.stream).toBeNull();
  });
  it("Test Case 2: MediaStream memory leak - hardware tracks are properly stopped when recording ends", async () => {
    // 1. Mock the MediaStream and track
    const mockStop = vi.fn();
    const mockTrack = { stop: mockStop };
    const mockMediaStream = {
      getTracks: vi.fn().mockReturnValue([mockTrack]),
    };

    // 2. Mock getUserMedia
    const mockGetUserMedia = vi.fn().mockResolvedValue(mockMediaStream);

    Object.defineProperty(global, "navigator", {
      value: {
        mediaDevices: {
          getUserMedia: mockGetUserMedia,
        },
      },
      writable: true,
    });

    // 3. Render and Act: Start recording
    const { result } = renderHook(() => useAudioRecorder());

    await act(async () => {
      await result.current.startRecording();
    });

    // Verify it is recording
    expect(result.current.isRecording).toBe(true);

    // 4. Trigger Cleanup: Stop recording
    act(() => {
      result.current.stopRecording();
    });

    // 5. Assert Hardware Release: Track must be stopped
    expect(mockStop).toHaveBeenCalledTimes(1);
    expect(result.current.isRecording).toBe(false);
    expect(result.current.stream).toBeNull();
  });
});
