type ExpandedFoldersState = Set<string>

type ExpandedFoldersAction = {
    type: 'toggle'
    path: string
} | {
    type: 'set'
    paths: Set<string>
}

export const expandedFoldersReducer = (state: ExpandedFoldersState, action: ExpandedFoldersAction): ExpandedFoldersState => {
    if (action.type === 'toggle') {
        const ret = new Set(state)
        if (ret.has(action.path)) {
            ret.delete(action.path)
        }
        else {
            ret.add(action.path)
        }
        return ret
    }
    else if (action.type === 'set') {
        return new Set(action.paths)
    }
    else {
        return state
    }
}