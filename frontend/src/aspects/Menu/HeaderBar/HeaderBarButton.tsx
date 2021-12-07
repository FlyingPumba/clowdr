import type { As, PropsOf } from "@chakra-ui/react";
import { Button, chakra, useColorModeValue } from "@chakra-ui/react";
import React, { forwardRef } from "react";
import { defaultOutline_AsBoxShadow } from "../../Chakra/Outline";
import { FAIcon } from "../../Icons/FAIcon";

type Props<T extends As<any> = typeof Button> = PropsOf<T> & {
    label: string;
    iconStyle: "b" | "s" | "r";
    icon: string | string[];
    side: "left" | "right";
    noTooltip?: boolean;
    showLabel: boolean;
    ariaLabel?: string;
};

const HeaderBarButton = forwardRef<HTMLButtonElement, Props>(function HeaderBarButton(
    { ariaLabel, label, showLabel, iconStyle, icon, children, ...props }: React.PropsWithChildren<Props>,
    ref
): JSX.Element {
    const buttonHoverBgColor = useColorModeValue(
        "MainMenuHeaderBar.buttonHoverBackgroundColor-light",
        "MainMenuHeaderBar.buttonHoverBackgroundColor-dark"
    );
    const buttonFocusBgColor = useColorModeValue(
        "MainMenuHeaderBar.buttonFocusBackgroundColor-light",
        "MainMenuHeaderBar.buttonFocusBackgroundColor-dark"
    );
    return (
        <Button
            aria-label={ariaLabel ?? label}
            ref={ref}
            variant="ghost"
            size="lg"
            w="auto"
            h="calc(100% - 3px)"
            p={0}
            m="3px"
            borderRadius={0}
            _hover={{
                bgColor: buttonHoverBgColor,
            }}
            _focus={{
                bgColor: buttonFocusBgColor,
                boxShadow: defaultOutline_AsBoxShadow,
            }}
            _active={{
                bgColor: buttonFocusBgColor,
                boxShadow: defaultOutline_AsBoxShadow,
            }}
            {...props}
        >
            {typeof icon === "string" ? (
                <FAIcon iconStyle={iconStyle} icon={icon} w={6} mr={showLabel ? 2 : 0} textAlign="center" />
            ) : (
                icon.map((ic, idx) => <FAIcon key={idx} iconStyle={iconStyle} icon={ic} />)
            )}
            {showLabel ? <chakra.span fontSize="sm">{label}</chakra.span> : undefined}
            {children}
        </Button>
    );
});

export default HeaderBarButton;
