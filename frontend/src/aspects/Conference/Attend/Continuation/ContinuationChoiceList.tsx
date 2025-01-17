import { Button, chakra, List, ListItem, useColorMode, useColorModeValue, useToken } from "@chakra-ui/react";
import { ContinuationDefaultFor } from "@midspace/shared-types/continuation";
import * as R from "ramda";
import React, { useEffect, useMemo } from "react";
import Color from "tinycolor2";
import type { ContinuationChoices_ContinuationFragment } from "../../../../generated/graphql";
import FAIcon from "../../../Chakra/FAIcon";

export default function ContinuationChoiceList({
    choices,
    isBackstage,
    noBackstage,
    currentRole,
    selectedOptionId,
    onChoiceSelected,
    leastDestructiveRef,
    selectDefault,
}: {
    choices: readonly ContinuationChoices_ContinuationFragment[];
    isBackstage: boolean;
    noBackstage: boolean;
    currentRole: ContinuationDefaultFor;
    leastDestructiveRef?: React.MutableRefObject<any>;
    selectedOptionId: string | null;
    onChoiceSelected: (choiceId: string | null, isDefault: boolean, isInitial: boolean) => void;
    selectDefault: boolean;
}): JSX.Element {
    const sortedChoices = useMemo(() => R.sortBy((x) => x.priority, choices), [choices]);
    const defaultOptionId = useMemo(() => {
        for (const option of sortedChoices) {
            switch (option.defaultFor) {
                case ContinuationDefaultFor.All:
                    return option.id;
                case ContinuationDefaultFor.Chairs:
                case ContinuationDefaultFor.Presenters:
                    if ((noBackstage || isBackstage) && currentRole === option.defaultFor) {
                        return option.id;
                    }
                    break;
                case ContinuationDefaultFor.Viewers:
                    if (noBackstage || !isBackstage) {
                        return option.id;
                    }
                    break;
            }
        }
        return null;
    }, [currentRole, isBackstage, noBackstage, sortedChoices]);
    useEffect(() => {
        if (selectDefault) {
            onChoiceSelected(defaultOptionId, true, true);
        }
    }, [defaultOptionId, onChoiceSelected, selectDefault]);

    return (
        <List spacing={2} py="3px">
            {sortedChoices.map((option) => (
                <ListItem key={option.id} w="100%">
                    <ContinuationChoice
                        option={option}
                        isSelected={selectedOptionId === option.id}
                        onSelect={() => {
                            onChoiceSelected(option.id, false, false);
                        }}
                    />
                </ListItem>
            ))}
            <ListItem w="100%">
                <Button
                    size="md"
                    textAlign="left"
                    w="100%"
                    justifyContent="flex-start"
                    alignItems="center"
                    onClick={(ev) => {
                        ev.stopPropagation();
                        onChoiceSelected(null, defaultOptionId === null, false);
                    }}
                    variant="outline"
                    ref={leastDestructiveRef}
                >
                    <chakra.span mr={2}>Stay on this page</chakra.span>
                    {selectedOptionId === null ? (
                        <FAIcon iconStyle="s" icon="check-circle" ml="auto" />
                    ) : (
                        <chakra.div w={6}></chakra.div>
                    )}
                </Button>
            </ListItem>
        </List>
    );
}

function ContinuationChoice({
    option,
    isSelected,
    onSelect,
}: {
    option: ContinuationChoices_ContinuationFragment;
    isSelected: boolean;
    onSelect: () => void;
}): JSX.Element {
    const borderColour = useColorModeValue("gray.300", "gray.600");
    const { colorMode } = useColorMode();
    const baseBgColour = colorMode === "light" ? "gray.200" : "gray.600";
    const baseGrey = useToken("colors", baseBgColour);
    const baseColour = useMemo(
        () => (Color(option.colour).getAlpha() !== 0 ? option.colour : baseGrey),
        [baseGrey, option.colour]
    );
    const bgColour = useMemo(() => Color(baseColour), [baseColour]);
    const bgColour_Hover = useMemo(
        () => (colorMode === "light" ? Color(baseColour).darken(15) : Color(baseColour).lighten(15)),
        [baseColour, colorMode]
    );
    const bgColour_Active = useMemo(
        () => (colorMode === "light" ? Color(baseColour).darken(30) : Color(baseColour).lighten(30)),
        [baseColour, colorMode]
    );

    const bgColour_IsDark = useMemo(() => bgColour.isDark(), [bgColour]);
    const bgColour_Hover_IsDark = useMemo(() => bgColour_Hover.isDark(), [bgColour_Hover]);
    const bgColour_Active_IsDark = useMemo(() => bgColour_Active.isDark(), [bgColour_Active]);

    const textColour = bgColour_IsDark ? "white" : "black";
    const textColour_Hover = bgColour_Hover_IsDark ? "white" : "black";
    const textColour_Active = bgColour_Active_IsDark ? "white" : "black";

    const shadow = useColorModeValue("md", "light-md");

    return (
        <Button
            size="md"
            textAlign="left"
            w="100%"
            justifyContent="flex-start"
            alignItems="center"
            bgColor={bgColour.toRgbString()}
            color={textColour}
            border={"1px solid"}
            borderColor={borderColour}
            shadow={shadow}
            _hover={{
                bgColor: bgColour_Hover.toRgbString(),
                color: textColour_Hover,
                shadow,
            }}
            _focus={{
                bgColor: bgColour_Hover.toRgbString(),
                color: textColour_Hover,
                boxShadow: "0 0 0 2px rgba(255, 187, 0, 0.8)",
            }}
            _active={{
                bgColor: bgColour_Active.toRgbString(),
                color: textColour_Active,
            }}
            onClick={(ev) => {
                ev.stopPropagation();
                onSelect();
            }}
            isActive={isSelected ? true : undefined}
        >
            <chakra.span mr={2}>{option.description}</chakra.span>
            {isSelected ? <FAIcon iconStyle="s" icon="check-circle" ml="auto" /> : <chakra.div w={6}></chakra.div>}
        </Button>
    );
}
