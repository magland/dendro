import { FunctionComponent } from "react"
import useRoute from "../../useRoute"
import UserIdComponent from "../../components/UserIdComponent"
import { Hyperlink } from "@fi-sci/misc"
import { useUserStats } from "../../hooks"

type UserPageProps = {
    // none
}

const UserPage: FunctionComponent<UserPageProps> = ({  }) => {
    const { route, setRoute } = useRoute()
    if (route.page !== 'user') {
        throw new Error('Invalid route')
    }
    return (
        <div style={{padding: 20}}>
            <div>
                <Hyperlink onClick={() => {
                    setRoute({page: 'home'})
                }}>Pairio home</Hyperlink>
            </div>
            <hr />
            <h3>User: <UserIdComponent userId={route.userId} /></h3>
            <UserStatsView userId={route.userId} />
        </div>
    )
}

type UserStatsViewProps = {
    userId: string
}

const UserStatsView: FunctionComponent<UserStatsViewProps> = ({ userId }) => {
    const { userStats } = useUserStats(userId)
    if (!userStats) {
        return (
            <div>
                Loading...
            </div>
        )
    }
    return (
        <div>
            <table className="table" style={{maxWidth: 700}}>
                <thead>
                    <tr>
                        <td />
                        <td>Consumed</td>
                        <td>Provided</td>
                        <td>Consumed (deleted)</td>
                        <td>Provided (deleted)</td>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>
                            Num. Jobs
                        </td>
                        <td>
                            {userStats.consumed.numJobs}
                        </td>
                        <td>
                            {userStats.provided.numJobs}
                        </td>
                        <td>
                            {userStats.consumedDeleted.numJobs}
                        </td>
                        <td>
                            {userStats.providedDeleted.numJobs}
                        </td>
                    </tr>
                    <tr>
                        <td>
                            CPU Hours
                        </td>
                        <td>
                            {userStats.consumed.cpuHours.toPrecision(5)}
                        </td>
                        <td>
                            {userStats.provided.cpuHours.toPrecision(5)}
                        </td>
                        <td>
                            {userStats.consumedDeleted.cpuHours.toPrecision(5)}
                        </td>
                        <td>
                            {userStats.providedDeleted.cpuHours.toPrecision(5)}
                        </td>
                    </tr>
                    <tr>
                        <td>
                            GPU Hours
                        </td>
                        <td>
                            {userStats.consumed.gpuHours.toPrecision(5)}
                        </td>
                        <td>
                            {userStats.provided.gpuHours.toPrecision(5)}
                        </td>
                        <td>
                            {userStats.consumedDeleted.gpuHours.toPrecision(5)}
                        </td>
                        <td>
                            {userStats.providedDeleted.gpuHours.toPrecision(5)}
                        </td>
                    </tr>
                    <tr>
                        <td>
                            GB Hours
                        </td>
                        <td>
                            {userStats.consumed.gbHours.toPrecision(5)}
                        </td>
                        <td>
                            {userStats.provided.gbHours.toPrecision(5)}
                        </td>
                        <td>
                            {userStats.consumedDeleted.gbHours.toPrecision(5)}
                        </td>
                        <td>
                            {userStats.providedDeleted.gbHours.toPrecision(5)}
                        </td>
                    </tr>
                    <tr>
                        <td>
                            Job Hours
                        </td>
                        <td>
                            {userStats.consumed.jobHours.toPrecision(5)}
                        </td>
                        <td>
                            {userStats.provided.jobHours.toPrecision(5)}
                        </td>
                        <td>
                            {userStats.consumedDeleted.jobHours.toPrecision(5)}
                        </td>
                        <td>
                            {userStats.providedDeleted.jobHours.toPrecision(5)}
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    )
}

export default UserPage