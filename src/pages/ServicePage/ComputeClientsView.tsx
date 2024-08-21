import { FunctionComponent, useCallback, useState } from "react";
import { useComputeClients, useService } from "../../hooks";
import ComputeClientsTable from "./ComputeClientsTable";
import { SmallIconButton } from "@fi-sci/misc";
import { Add, Refresh } from "@mui/icons-material";

type ComputeClientsViewProps = {
  serviceName: string;
};

export const ComputeClientsView: FunctionComponent<ComputeClientsViewProps> = ({
  serviceName,
}) => {
  const { computeClients, refreshComputeClients } =
    useComputeClients(serviceName);
  const { createComputeClient } = useService(serviceName);
  const [newComputeClientInfo, setNewComputeClientInfo] = useState<{
    computeClientId: string;
    computeClientPrivateKey: string;
  } | null>(null);

  const handleAddComputeClient = useCallback(async () => {
    const computeClientName = prompt(
      "Enter a unique name for the compute client",
    );
    if (!computeClientName) return;
    const x = await createComputeClient({ computeClientName });
    if (!x) return;
    const { computeClientId, computeClientPrivateKey } = x;
    setNewComputeClientInfo({ computeClientId, computeClientPrivateKey });
    refreshComputeClients();
  }, [createComputeClient, refreshComputeClients]);

  const newClientElement = newComputeClientInfo && (
    <div>
      <h3>Compute client created:</h3>
      <div>
        <div>New client ID: {newComputeClientInfo.computeClientId}</div>
        <div>
          New private key: {newComputeClientInfo.computeClientPrivateKey}
        </div>
      </div>
      <div>&nbsp;</div>
    </div>
  );

  const handleRefreshComputeClients = useCallback(() => {
    refreshComputeClients({ pingFirst: true });
  }, [refreshComputeClients]);

  if (!computeClients) {
    return (
      <div>
        {newClientElement}
        <div style={{ padding: 20 }}>
          <p>Loading compute clients for service {serviceName}...</p>
        </div>
      </div>
    );
  }
  return (
    <div>
      {newClientElement}
      <div>
        <SmallIconButton
          icon={<Refresh />}
          onClick={handleRefreshComputeClients}
        />
        <SmallIconButton
          onClick={handleAddComputeClient}
          icon={<Add />}
          label="Add compute client"
        />
      </div>
      <ComputeClientsTable computeClients={computeClients} />
    </div>
  );
};

export default ComputeClientsView;
