import * as luxon from "luxon";
import React, { useMemo } from "react";
import { gql } from "urql";
import { useScheduleV2_AllEvents_ParamsQuery } from "../../../../../generated/graphql";
import CenteredSpinner from "../../../../Chakra/CenteredSpinner";
import { useConference } from "../../../useConference";
import Schedule from "./Schedule";

gql`
    query ScheduleV2_AllEvents_Params($conferenceId: uuid!) {
        earliestStartingEvent: schedule_Event(
            where: { conferenceId: { _eq: $conferenceId } }
            limit: 1
            order_by: { startTime: asc }
        ) {
            id
            startTime
            conferenceId
        }
        latestEndingEvent: schedule_Event(
            where: { conferenceId: { _eq: $conferenceId } }
            limit: 1
            order_by: { endTime: desc }
        ) {
            id
            endTime
            conferenceId
        }
    }
`;

export default function WholeSchedule(): JSX.Element {
    const conference = useConference();
    const [eventsResponse] = useScheduleV2_AllEvents_ParamsQuery({
        variables: {
            conferenceId: conference.id,
        },
    });

    const earliestStartingTime = useMemo(() => {
        if (eventsResponse.data?.earliestStartingEvent) {
            return luxon.DateTime.fromISO(eventsResponse.data.earliestStartingEvent[0].startTime);
        }
        return undefined;
    }, [eventsResponse.data?.earliestStartingEvent]);

    const latestEndingTime = useMemo(() => {
        if (eventsResponse.data?.latestEndingEvent[0]?.endTime) {
            return luxon.DateTime.fromISO(eventsResponse.data.latestEndingEvent[0].endTime);
        }
        return undefined;
    }, [eventsResponse.data?.latestEndingEvent]);

    if (eventsResponse.fetching || !eventsResponse.data) {
        return <CenteredSpinner caller="WholeSchedule:55" />;
    }

    if (!earliestStartingTime || !latestEndingTime) {
        return <>No events</>;
    }

    return <Schedule earliestStartingTime={earliestStartingTime} latestEndingTime={latestEndingTime} />;
}
