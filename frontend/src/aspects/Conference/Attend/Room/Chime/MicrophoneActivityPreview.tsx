import { chakra, FormControl, FormLabel, Progress, useId } from "@chakra-ui/react";
import { useLocalAudioInputActivity, useToggleLocalMute } from "amazon-chime-sdk-component-library-react";
import React, { useCallback, useRef, useState } from "react";
import usePolling from "../../../../Hooks/usePolling";

export function MicrophoneActivityPreviewInner({ className }: { className?: string }): JSX.Element {
    const [value, setValue] = useState<number>(0);
    const valueRef = useRef<number>(0);
    const { muted } = useToggleLocalMute();
    useLocalAudioInputActivity((d) => {
        let oldValue = valueRef.current;
        oldValue -= oldValue / 5;
        oldValue += d / 5;

        valueRef.current = muted ? 0 : oldValue;
    });
    const id = useId();

    const cb = useCallback(() => setValue(valueRef.current), []);
    usePolling(cb, 200, true);

    return (
        <FormControl className={className}>
            <FormLabel htmlFor={id}>Microphone activity</FormLabel>
            <Progress id={id} sx={{ div: { transition: "all 0.2s" } }} value={value} min={0} max={1} />
        </FormControl>
    );
}

export const MicrophoneActivityPreview = chakra(MicrophoneActivityPreviewInner);
