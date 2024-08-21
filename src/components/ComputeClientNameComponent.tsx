import { Hyperlink } from "@fi-sci/misc";
import { FunctionComponent } from "react";
import useRoute from "../useRoute";

type ComputeClientNameComponentProps = {
  computeClientId: string;
  computeClientName: string;
};

const ComputeClientNameComponent: FunctionComponent<
  ComputeClientNameComponentProps
> = ({ computeClientId, computeClientName }) => {
  const { setRoute } = useRoute();
  const computeClientNameDisplay = computeClientName;
  return (
    <Hyperlink
      onClick={() => {
        setRoute({ page: "compute_client", computeClientId });
      }}
      color="#552"
    >
      {computeClientNameDisplay}
    </Hyperlink>
  );
};

export default ComputeClientNameComponent;
