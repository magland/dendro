import { FunctionComponent } from "react"
import useRoute from "../../useRoute"
import UserIdComponent from "../../components/UserIdComponent"
import { Hyperlink } from "@fi-sci/misc"

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
            <h3>User: <UserIdComponent userId={route.userId} /></h3>
            <div>
                <Hyperlink onClick={() => {
                    setRoute({page: 'home'})
                }}>Pairio home</Hyperlink>
            </div>
        </div>
    )
}

export default UserPage