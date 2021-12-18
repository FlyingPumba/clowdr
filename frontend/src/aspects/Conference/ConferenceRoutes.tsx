import { Spinner } from "@chakra-ui/react";
import React, { Suspense, useEffect } from "react";
import type { RouteComponentProps } from "react-router-dom";
import { Redirect, Route, Switch, useRouteMatch } from "react-router-dom";
import CenteredSpinner from "../Chakra/CenteredSpinner";
import { useConferenceTheme } from "../Chakra/ChakraCustomProvider";
import { useAuthParameters } from "../GQL/AuthParameters";
import useMaybeCurrentUser from "../Users/CurrentUser/useMaybeCurrentUser";
import RequireRole from "./RequireRole";
import { useConference } from "./useConference";
import { useMaybeCurrentRegistrant } from "./useCurrentRegistrant";

const EditProfilePage = React.lazy(() => import("./Attend/Profile/EditProfilePage"));
const ViewProfilePage = React.lazy(() => import("./Attend/Profile/ViewProfilePage"));
const MyBackstages = React.lazy(() => import("./Attend/Profile/MyBackstages"));
const ItemPage = React.lazy(() => import("./Attend/Content/ItemPage"));
const ConferenceLandingPage = React.lazy(() => import("./Attend/ConferenceLandingPage"));
const ExhibitionPage = React.lazy(() => import("./Attend/Exhibition/ExhibitionPage"));
const ExhibitionsPage = React.lazy(() => import("./Attend/Exhibition/ExhibitionsPage"));
const MyRecordingsPage = React.lazy(() => import("./Attend/Recordings/MyRecordingsPage"));
const RegistrantListPage = React.lazy(() => import("./Attend/Registrant/RegistrantListPage"));
const RoomPage = React.lazy(() => import("./Attend/Room/RoomPage"));
const RoomListPageV1 = React.lazy(() => import("./Attend/Rooms/V1/RoomListPage"));
const Schedule = React.lazy(() => import("./Attend/Schedule/v1/Schedule"));
const ScheduleV2 = React.lazy(() => import("./Attend/Schedule/v2/WholeSchedule"));
const SwagBags = React.lazy(() => import("./Attend/SwagBag/SwagBags"));
const ChatRedirectPage = React.lazy(() => import("../Chat/ChatRedirectPage"));
const WaitingPage = React.lazy(() => import("../ShuffleRooms/WaitingPage"));
const PageNotFound = React.lazy(() => import("../Errors/PageNotFound"));

export default function ConferenceRoutes(): JSX.Element {
    const conference = useConference();
    const { setTheme } = useConferenceTheme();
    const mUser = useMaybeCurrentUser();
    const mRegistrant = useMaybeCurrentRegistrant();

    const { path, url } = useRouteMatch();

    useEffect(() => {
        setTheme(conference.themeComponentColors?.[0]?.value);
    }, [conference.themeComponentColors, setTheme]);

    return (
        <Suspense fallback={<Spinner />}>
            <Switch>
                <Route exact path={`${path}/profile/edit`} component={EditProfilePage} />

                <Route exact path={`${path}/profile/view`} component={ViewProfilePage} />

                {mUser.user ? (
                    <Route exact path={`${path}/profile`}>
                        <Redirect to={`${url}/profile/edit`} />
                    </Route>
                ) : undefined}

                {mRegistrant && mRegistrant.profile && !mRegistrant.profile.hasBeenEdited ? (
                    <Route path={path}>
                        <Redirect to={`${url}/profile/edit`} />
                    </Route>
                ) : undefined}

                {mRegistrant && <Route exact path={`${path}/profile/backstages`} component={MyBackstages} />}

                <Route path={`${path}/manage`}>
                    <RequireRole organizerRole moderatorRole componentIfDenied={<PageNotFound />}>
                        <ManageConferenceRoutes />
                    </RequireRole>
                </Route>

                <Route
                    path={`${path}/item/:itemId`}
                    component={(props: RouteComponentProps<{ itemId: string }>) => (
                        <ItemPage itemId={props.match.params.itemId} />
                    )}
                />
                <Route path={`${path}/exhibitions`}>
                    <ExhibitionsPage />
                </Route>
                <Route
                    path={`${path}/exhibition/:exhibitionId`}
                    component={(props: RouteComponentProps<{ exhibitionId: string }>) => (
                        <ExhibitionPage exhibitionId={props.match.params.exhibitionId} />
                    )}
                />

                <Route path={`${path}/rooms`}>
                    <RoomListPageV1 />
                </Route>

                <Route path={`${path}/registrants`}>
                    <RequireRole componentIfDenied={<Redirect to={path} />} organizerRole>
                        <RegistrantListPage />
                    </RequireRole>
                </Route>

                <Route path={`${path}/swag`}>
                    <RequireRole componentIfDenied={<Redirect to={path} />} attendeeRole>
                        <SwagBags />
                    </RequireRole>
                </Route>

                <Route
                    path={`${path}/room/:roomId`}
                    component={(
                        props: RouteComponentProps<{
                            roomId: string;
                            eventId?: string;
                        }>
                    ) => <RoomPage roomId={props.match.params.roomId} />}
                />

                <Route path={`${path}/schedule/v2`}>
                    <RequireRole componentIfDenied={<Redirect to={path} />} attendeeRole>
                        <ScheduleV2 />
                    </RequireRole>
                </Route>

                <Route path={`${path}/schedule`}>
                    <RequireRole componentIfDenied={<Redirect to={path} />} attendeeRole>
                        <Schedule />
                    </RequireRole>
                </Route>

                <Route exact path={`${path}/profile/edit/:registrantId`}>
                    {(props) =>
                        props.match?.params.registrantId ? (
                            <EditProfilePage
                                registrantId={
                                    props.match?.params.registrantId && props.match?.params.registrantId.length > 0
                                        ? props.match?.params.registrantId
                                        : undefined
                                }
                            />
                        ) : (
                            <Redirect to={path} />
                        )
                    }
                </Route>

                <Route exact path={`${path}/profile/view/:registrantId`}>
                    {(props) =>
                        props.match?.params.registrantId ? (
                            <ViewProfilePage
                                registrantId={
                                    props.match?.params.registrantId && props.match?.params.registrantId.length > 0
                                        ? props.match?.params.registrantId
                                        : undefined
                                }
                            />
                        ) : (
                            <Redirect to={path} />
                        )
                    }
                </Route>

                <Route path={`${path}/chat/:chatId`}>
                    {(props) =>
                        props.match?.params.chatId ? (
                            <ChatRedirectPage chatId={props.match.params.chatId} />
                        ) : (
                            <Redirect to={path} />
                        )
                    }
                </Route>
                <Route path={`${path}/shuffle`}>
                    <RequireRole componentIfDenied={<Redirect to={path} />} attendeeRole>
                        <WaitingPage />
                    </RequireRole>
                </Route>

                <Route path={`${path}/recordings`}>
                    <RequireRole componentIfDenied={<PageNotFound />} attendeeRole>
                        <MyRecordingsPage />
                    </RequireRole>
                </Route>

                <Route exact path={`${path}`}>
                    <ConferenceLandingPage />
                </Route>

                <Route path={path}>
                    <PageNotFound />
                </Route>
            </Switch>
        </Suspense>
    );
}

const AnalyticsDashboard = React.lazy(() => import("./Manage/Analytics/AnalyticsDashboard"));
const ManageBroadcast = React.lazy(() => import("./Manage/Broadcast/ManageBroadcasts"));
const ManageModeration = React.lazy(() => import("./Manage/Chat/Moderation/ManageModeration"));
const ChecklistPage = React.lazy(() => import("./Manage/Checklist/ChecklistPage"));
const ManageContent = React.lazy(() => import("./Manage/Content/ManageContent"));
const ManageEmail = React.lazy(() => import("./Manage/Email/ManageEmail"));
const ManageExport = React.lazy(() => import("./Manage/Export/ManageExport"));
const ManageImport = React.lazy(() => import("./Manage/Import/ManageImport"));
const ManageDetails = React.lazy(() => import("./Manage/ManageDetails"));
const ManageGroups = React.lazy(() => import("./Manage/ManageGroups"));
const ManageProgramPeople = React.lazy(() => import("./Manage/ManageProgramPeople"));
const ManagerLanding = React.lazy(() => import("./Manage/ManagerLanding"));
const ManageRooms = React.lazy(() => import("./Manage/ManageRooms"));
const ManageRegistrants = React.lazy(() => import("./Manage/Registrants/ManageRegistrants"));
const ManageSchedule = React.lazy(() => import("./Manage/Schedule/ManageSchedule"));
const ManageShuffle = React.lazy(() => import("./Manage/Shuffle/ManageShuffle"));
const ManageTheme = React.lazy(() => import("./Manage/Theme/ManageTheme"));
const ManageConfig = React.lazy(() => import("./Manage/Configuration/ManageConfig"));
const PageNotImplemented = React.lazy(() => import("../Errors/PageNotImplemented"));

function ManageConferenceRoutes(): JSX.Element {
    const { path } = useRouteMatch();
    const { isOnManagementPage, setIsOnManagementPage } = useAuthParameters();

    useEffect(() => {
        setIsOnManagementPage(true);
        return () => {
            setIsOnManagementPage(false);
        };
    }, [setIsOnManagementPage]);

    return isOnManagementPage ? (
        <Suspense fallback={<Spinner />}>
            <Switch>
                <Route exact path={path}>
                    <ManagerLanding />
                </Route>
                <Route path={`${path}/details`}>
                    <ManageDetails />
                </Route>
                <Route path={`${path}/groups`}>
                    <ManageGroups />
                </Route>
                <Route path={`${path}/registrants`}>
                    <ManageRegistrants />
                </Route>
                <Route path={`${path}/people`}>
                    <ManageProgramPeople />
                </Route>
                <Route path={`${path}/content`}>
                    <ManageContent />
                </Route>
                <Route path={`${path}/import`}>
                    <ManageImport />
                </Route>
                <Route path={`${path}/rooms`}>
                    <ManageRooms />
                </Route>
                <Route path={`${path}/shuffle`}>
                    <ManageShuffle />
                </Route>
                <Route path={`${path}/broadcasts`}>
                    <ManageBroadcast />
                </Route>
                <Route path={`${path}/export`}>
                    <ManageExport />
                </Route>
                <Route path={`${path}/schedule`}>
                    <ManageSchedule />
                </Route>
                <Route path={`${path}/chats/moderation`}>
                    <ManageModeration />
                </Route>
                <Route path={`${path}/chats`}>
                    <PageNotImplemented />
                </Route>
                <Route path={`${path}/email`}>
                    <ManageEmail />
                </Route>
                <Route path={`${path}/checklist`}>
                    <ChecklistPage />
                </Route>
                <Route path={`${path}/analytics`}>
                    <AnalyticsDashboard />
                </Route>
                <Route path={`${path}/support`}>
                    <PageNotImplemented />
                </Route>
                <Route path={`${path}/theme`}>
                    <ManageTheme />
                </Route>
                <Route path={`${path}/settings`}>
                    <ManageConfig />
                </Route>

                <Route path="/">
                    <PageNotFound />
                </Route>
            </Switch>
        </Suspense>
    ) : (
        <CenteredSpinner caller="ConferenceRoute:290" />
    );
}
