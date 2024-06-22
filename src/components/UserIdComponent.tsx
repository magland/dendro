import { Hyperlink } from "@fi-sci/misc"
import { FunctionComponent } from "react"
import useRoute from "../useRoute"

type UserIdComponentProps = {
    userId: string
}

const UserIdComponent: FunctionComponent<UserIdComponentProps> = ({ userId }) => {
    const { setRoute } = useRoute()
    const userIdDisplay = userId.startsWith('github|') ? userId.slice('github|'.length) : userId
    return (
        <Hyperlink
            onClick={() => {
                setRoute({page: 'user', userId: userId})
            }}
            color='#224'
        >{userIdDisplay}</Hyperlink>
    )
}

export default UserIdComponent