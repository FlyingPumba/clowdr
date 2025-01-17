import type { AlertProps } from "@chakra-ui/react";
import { Alert, AlertDescription, AlertIcon, Button, chakra, CloseButton } from "@chakra-ui/react";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ErrorBoundary } from "react-error-boundary";
import type { VideoJsPlayer, VideoJsPlayerOptions } from "video.js";
import videojs from "video.js";
import "video.js/dist/video-js.css";
import "videojs-contrib-quality-levels";
import hlsQualitySelector from "videojs-hls-quality-selector";
import { useRestorableState, useSessionState } from "../../../../Hooks/useRestorableState";
import useTrackView from "../../../../Realtime/Analytics/useTrackView";
import "./hls-player.css";
import { HlsPlayerError } from "./HlsPlayerError";

const VideoJSInner = React.forwardRef<
    HTMLVideoElement,
    React.DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement>
>(function VideoJSInner(
    props: React.DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement>,
    ref: React.ForwardedRef<HTMLVideoElement>
): JSX.Element {
    return (
        <div data-vjs-player {...props} style={{ position: "relative", ...(props.style ?? {}) }}>
            <video ref={ref} className="video-js vjs-big-play-centered" crossOrigin="anonymous" />
        </div>
    );
});

function PlayerAnalytics({ isPlaying, roomId }: { isPlaying: boolean; roomId: string }) {
    useTrackView(isPlaying, roomId, "Room.HLSStream");

    return null;
}

function NonLiveAlert({
    onReload,
    onDismiss,
    ...props
}: AlertProps & { onReload: () => void; onDismiss: () => void }): JSX.Element {
    return (
        <Alert status="warning" p={1} display="flex" flexDir="row" {...props}>
            <AlertIcon ml={2} />
            <AlertDescription fontSize="sm">
                You may need to reload this video to get the latest content.
            </AlertDescription>
            <Button ml="auto" mr={2} size="sm" onClick={onReload}>
                Reload
            </Button>
            <CloseButton onClick={onDismiss} />
        </Alert>
    );
}

type HlsPlayerProps = {
    roomId?: string;
    hlsUri: string;
    canPlay: boolean;
    forceMute?: boolean;
    initialMute?: boolean;
    expectLivestream?: boolean;
    onAspectRatioChange?: (aspectRatio: number) => void;
};

export function HlsPlayerInner({
    roomId,
    hlsUri,
    canPlay,
    forceMute,
    initialMute,
    expectLivestream,
    onAspectRatioChange,
}: HlsPlayerProps): JSX.Element {
    const playerRef = useRef<VideoJsPlayer | null>(null);

    const [isPlaying, setIsPlaying] = useState<boolean>(false);
    const [intendPlayStream, setIntendPlayStream] = useState<boolean>(true);
    const [intendMuted, setIntendMuted] = useSessionState<boolean>(
        "StreamPlayer_IntendMuted",
        false,
        (x) => (x ? "true" : "false"),
        (x) => x === "true"
    );
    const [volume, setVolume] = useRestorableState<number>(
        "StreamPlayer_Volume",
        1.0,
        (x) => x.toString(),
        (x) => parseFloat(x)
    );
    const [isLive, setIsLive] = useState<boolean>(false);
    const [dismissAlert, setDismissAlert] = useState<boolean>(false);

    useEffect(() => {
        setDismissAlert(false);
    }, [expectLivestream]);

    const videoRef = useRef<HTMLVideoElement>(null);
    const [videoKey, setVideoKey] = useState<number>(0);

    const options = useMemo<VideoJsPlayerOptions>(
        () => ({
            autoplay: initialMute ? "muted" : "play",
            bigPlayButton: true,
            controls: true,
            fluid: true,
            liveui: true,
            preload: "auto",
            src: hlsUri,
            html5: {
                vhs: {
                    parse708captions: false,
                },
            },
        }),
        [hlsUri, initialMute]
    );

    useEffect(() => {
        if (canPlay && intendPlayStream) {
            videoRef?.current?.play();
        }
    }, [canPlay, intendPlayStream]);

    // This is deliberately designed so that force mute operates
    // as a one-off mute (an effect) rather than a global force
    // which the user would be unable to override.
    //
    // This is so that force mute will trigger a stream preview
    // to be muted when the backstage goes live. But the preview
    // can be unmuted by the user if needed/desired.
    useEffect(() => {
        if (!videoRef.current) {
            return;
        }
        videoRef.current.muted = intendMuted;
    }, [intendMuted]);
    useEffect(() => {
        if (!videoRef.current) {
            return;
        }
        videoRef.current.muted = forceMute || videoRef.current.muted;
    }, [forceMute]);

    useEffect(() => {
        if (!videoRef.current || videoRef.current.volume === volume) {
            return;
        }
        videoRef.current.volume = volume;
    }, [volume]);

    const addListeners = useCallback(
        (videoElement: HTMLVideoElement) => {
            const onPlay = () => {
                setIntendPlayStream(true);
            };
            videoElement.addEventListener("play", onPlay);
            const onPlaying = () => {
                setIsPlaying(true);
            };
            videoElement.addEventListener("playing", onPlaying);
            const onPause = () => {
                setIsPlaying(false);
                setIntendPlayStream(false);
            };
            videoElement.addEventListener("pause", onPause);
            const onEnded = () => {
                setIsPlaying(false);
            };
            videoElement.addEventListener("ended", onEnded);
            const onError = () => {
                setIsPlaying(false);
            };
            videoElement.addEventListener("error", onError);
            const onWaiting = () => {
                setIsPlaying(false);
            };
            videoElement.addEventListener("waiting", onWaiting);
            const onVolumeChange = () => {
                if (videoElement) {
                    setIntendMuted(videoElement.muted ?? false);
                    setVolume(videoElement.volume);
                }
            };
            videoElement.addEventListener("volumechange", onVolumeChange);
            const onResize = () => {
                if (videoElement && videoElement.videoWidth !== 0 && videoElement.videoHeight !== 0) {
                    onAspectRatioChange?.(videoElement.videoWidth / videoElement.videoHeight);
                }
            };
            videoElement.addEventListener("resize", onResize);

            return () => {
                videoElement?.removeEventListener("play", onPlay);
                videoElement?.removeEventListener("playing", onPlaying);
                videoElement?.removeEventListener("pause", onPause);
                videoElement?.removeEventListener("ended", onEnded);
                videoElement?.removeEventListener("error", onError);
                videoElement?.removeEventListener("waiting", onWaiting);
                videoElement?.removeEventListener("volumechange", onVolumeChange);
                videoElement?.removeEventListener("resize", onResize);
            };
        },
        [onAspectRatioChange, setIntendMuted, setVolume]
    );

    useEffect(() => {
        return () => {
            const player = playerRef.current;
            playerRef.current = null;
            setVideoKey((i) => i + 1);
            setTimeout(() => {
                if (player && !player.isDisposed()) {
                    player.dispose();
                }
            }, 0);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const initialisePlayer = useCallback(
        (options: VideoJsPlayerOptions) => {
            // Registered on import, but it likes to deregister itself
            if (!videojs.getPlugin("hlsQualitySelector")) {
                videojs.registerPlugin("hlsQualitySelector", hlsQualitySelector);
            }
            const removeListeners = videoRef.current ? addListeners(videoRef.current) : null;

            const targetVideoEl = videoRef.current;
            const player = (playerRef.current = targetVideoEl
                ? videojs(
                      targetVideoEl,
                      { ...options, muted: forceMute || intendMuted ? true : undefined, defaultVolume: volume },
                      function onReady(this: VideoJsPlayer): void {
                          if (this === playerRef.current) {
                              if (options.src) {
                                  this.src(options.src);
                              }
                              // This will probably crash occasionally without this guard
                              if (typeof this.hlsQualitySelector === "function") {
                                  this.hlsQualitySelector({ displayCurrentQuality: true });
                              } else {
                                  console.warn("hlsQualitySelector plugin was not registered, skipping initialisation");
                              }

                              const onLoadedMetadata = () => {
                                  const tracks = this.textTracks();
                                  for (let i = 0; i < tracks.length; i++) {
                                      tracks[i].mode = "disabled";
                                  }
                                  if (this.videoWidth() !== 0 && this.videoHeight() !== 0) {
                                      onAspectRatioChange?.(this.videoWidth() / this.videoHeight());
                                  }
                                  setDismissAlert(false);
                                  setIsLive(this.duration() === Infinity);
                              };

                              this.on("loadedmetadata", onLoadedMetadata);
                              this.one("playerreset", () => {
                                  this.off("loadedmetadata", onLoadedMetadata);
                              });
                          }
                      }
                  )
                : null);

            return () => {
                if (player && player === playerRef.current && !player.isDisposed()) {
                    removeListeners?.();
                    if (targetVideoEl && targetVideoEl === videoRef.current) {
                        player.reset();
                    }
                }
            };
        },
        [addListeners, forceMute, intendMuted, onAspectRatioChange, volume]
    );

    // Re-initialise the player when the options (i.e. the stream URI) change
    useEffect(() => {
        return initialisePlayer(options);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [options, videoKey]);

    const handleReload = useCallback(() => {
        setDismissAlert(true);
        initialisePlayer(options);
    }, [initialisePlayer, options]);

    const handleDismiss = useCallback(() => {
        setDismissAlert(true);
    }, [setDismissAlert]);

    return (
        <chakra.div h="100%" w="100%" position="relative">
            {roomId ? <PlayerAnalytics isPlaying={isPlaying} roomId={roomId} /> : undefined}
            <VideoJSInner ref={videoRef} style={{ zIndex: 1 }} key={videoKey} />
            {!isLive && expectLivestream && !dismissAlert ? (
                <NonLiveAlert
                    position="absolute"
                    width="100%"
                    zIndex={2}
                    top={0}
                    onReload={handleReload}
                    onDismiss={handleDismiss}
                />
            ) : undefined}
        </chakra.div>
    );
}

export default function HlsPlayer(props: HlsPlayerProps): JSX.Element {
    return (
        <ErrorBoundary FallbackComponent={HlsPlayerError}>
            <HlsPlayerInner {...props} />
        </ErrorBoundary>
    );
}
