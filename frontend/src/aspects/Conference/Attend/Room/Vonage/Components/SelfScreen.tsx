import { useToast } from "@chakra-ui/react";
import React, { useContext, useEffect, useRef } from "react";
import { PermissionInstructionsContext } from "../../VideoChat/PermissionInstructionsContext";
import CameraContainer from "../Components/CameraContainer";
import { CameraViewport } from "../Components/CameraViewport";
import type { VonageGlobalState } from "../State/VonageGlobalState";
import type { VonageRoomState } from "../State/VonageRoomProvider";

export default function SelfScreenComponent({
    connected,
    state,
    vonage,
    registrantId,
    screen,
}: {
    connected: boolean;
    state: VonageRoomState;
    vonage: VonageGlobalState;
    registrantId: string;
    screen: OT.Publisher | null;
}): JSX.Element {
    const toast = useToast();
    const { onPermissionsProblem } = useContext(PermissionInstructionsContext);

    const screenPublishContainerRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        async function fn() {
            if (connected) {
                if (state.screenShareIntendedEnabled && !screen) {
                    try {
                        await vonage.publishScreen(screenPublishContainerRef.current as HTMLElement);
                    } catch (err) {
                        console.error("Failed to publish screen", { err });
                        onPermissionsProblem({ screen: true }, "Failed to publish screen");
                    }
                } else if (!state.screenShareIntendedEnabled && screen) {
                    try {
                        await vonage.unpublishScreen();
                    } catch (err) {
                        console.error("Failed to unpublish screen", { err });
                        toast({
                            status: "error",
                            title: "Failed to unshare screen",
                        });
                    }
                }
            }
        }
        fn();
    }, [connected, state.screenShareIntendedEnabled, screen, toast, vonage, onPermissionsProblem]);

    return (
        <CameraViewport registrantId={registrantId} enableVideo={true} stream={vonage.screen?.stream}>
            <CameraContainer ref={screenPublishContainerRef} />
        </CameraViewport>
    );
}
