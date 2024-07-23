import { Hyperlink } from "@fi-sci/misc"
import { FunctionComponent } from "react"
import useRoute from "../useRoute"

type UserIdComponentProps = {
    userId: string
    followLink?: boolean
}

const UserIdComponent: FunctionComponent<UserIdComponentProps> = ({ userId, followLink }) => {
    const { setRoute } = useRoute()
    const userIdDisplay = userId.startsWith('github|') ? userId.slice('github|'.length) : userId
    return (
        <Hyperlink
            onClick={() => {
                if (followLink) setRoute({page: 'user', userId: userId})
            }}
            color='#224'
        >{userIdDisplay}</Hyperlink>
    )
}

export default UserIdComponent