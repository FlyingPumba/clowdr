import type { ButtonProps } from "@chakra-ui/react";
import { Button, useToast } from "@chakra-ui/react";
import type { EventAttributes } from "ics";
import ics from "ics";
import React from "react";
import FAIcon from "../../../../Chakra/FAIcon";
import { useAuthParameters } from "../../../../GQL/AuthParameters";
import { useConference } from "../../../useConference";
import type { TimelineEvent } from "./DayList";

type Props = {
    events: () => ReadonlyArray<TimelineEvent>;
    calendarName: string;
} & ButtonProps;

const DownloadCalendarButton = React.forwardRef<HTMLButtonElement, Props>(function DownloadCalendarButton(
    { events, calendarName, ...props }: Props,
    ref
): JSX.Element {
    const conference = useConference();
    const { conferencePath } = useAuthParameters();
    const toast = useToast();
    return (
        <Button
            ref={ref}
            size="sm"
            aria-label="Download calendar file"
            colorScheme="PrimaryActionButton"
            {...props}
            onClick={() => {
                const convertedEvents: EventAttributes[] = events().map((event) => {
                    const scheduledStartTime = new Date(event.scheduledStartTime);
                    const scheduledEndTime = new Date(event.scheduledEndTime);
                    return {
                        uid: event.id + "@" + window.location.hostname,
                        title: event.item ? `${event.item.title} (${event.name})` : event.name,
                        url: `${window.location.origin}${conferencePath}/room/${event.roomId}`,
                        location: `${window.location.origin}${conferencePath}/room/${event.roomId}`,
                        start: [
                            scheduledStartTime.getUTCFullYear(),
                            scheduledStartTime.getUTCMonth() + 1,
                            scheduledStartTime.getUTCDate(),
                            scheduledStartTime.getUTCHours(),
                            scheduledStartTime.getUTCMinutes(),
                        ],
                        startInputType: "utc",
                        end: [
                            scheduledEndTime.getUTCFullYear(),
                            scheduledEndTime.getUTCMonth() + 1,
                            scheduledEndTime.getUTCDate(),
                            scheduledEndTime.getUTCHours(),
                            scheduledEndTime.getUTCMinutes(),
                        ],
                        endInputType: "utc",
                        calName: conference.shortName + ": " + calendarName,
                        busyStatus: "BUSY",
                        alarms: [
                            {
                                action: "display",
                                trigger: {
                                    before: true,
                                    minutes: 15,
                                },
                            },
                        ],
                    };
                });
                const { error, value } = ics.createEvents(convertedEvents);
                if (error) {
                    toast({
                        description: error.name + ": " + error.message,
                        title: "Error generating calendar",
                        duration: 15000,
                        isClosable: true,
                        position: "top",
                        status: "error",
                    });
                } else if (value) {
                    const dataBlob = new Blob([value], { type: "text/calendar;charset=utf-8;" });
                    let fileURL: string | null = null;
                    const now = new Date();
                    const fileName = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, "0")}-${now
                        .getDate()
                        .toString()
                        .padStart(2, "0")}T${now.getHours().toString().padStart(2, "0")}-${now
                        .getMinutes()
                        .toString()
                        .padStart(2, "0")} - ${conference.shortName} - ${calendarName}.ics`;

                    fileURL = window.URL.createObjectURL(dataBlob);

                    const tempLink = document.createElement("a");
                    tempLink.href = fileURL ?? "";
                    tempLink.setAttribute("download", fileName);
                    tempLink.click();
                }
            }}
        >
            <FAIcon iconStyle="s" icon="file-download" mr={2} />
            Download calendar
        </Button>
    );
});

export default DownloadCalendarButton;
