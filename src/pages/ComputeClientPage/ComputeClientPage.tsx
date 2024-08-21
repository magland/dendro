/* eslint-disable @typescript-eslint/no-explicit-any */
import { SmallIconButton, isArrayOf } from "@fi-sci/misc";
import { Edit, Save } from "@mui/icons-material";
import yaml from "js-yaml";
import { FunctionComponent, useEffect, useMemo, useState } from "react";
import ComputeClientNameComponent from "../../components/ComputeClientNameComponent";
import ServiceNameComponent from "../../components/ServiceNameComponent";
import UserIdComponent from "../../components/UserIdComponent";
import { useComputeClient } from "../../hooks";
import { timeAgoString } from "../../timeStrings";
import {
  ComputeClientComputeSlot,
  isComputeClientComputeSlot,
} from "../../types";
import useRoute from "../../useRoute";
import JobsView from "./JobsView";

type ComputeClientPageProps = {
  // none
};

const ComputeClientPage: FunctionComponent<ComputeClientPageProps> = () => {
  const { route, setRoute } = useRoute();
  // const [errorMessage, setErrorMessage] = useState<string | null>(null)
  if (route.page !== "compute_client") {
    throw new Error("Invalid route");
  }
  const computeClientId = route.computeClientId;
  const { computeClient, deleteComputeClient, setComputeClientInfo } =
    useComputeClient(computeClientId);

  const handleEditServices = () => {
    if (!computeClient) return;
    const txt = computeClient.serviceNames.join(", ");
    const newTxt = window.prompt("Edit services:", txt);
    const newServiceNames = newTxt
      ? newTxt.split(",").map((x) => x.trim())
      : [];
    if (newServiceNames.join(",") === computeClient.serviceNames.join(","))
      return;
    setComputeClientInfo({ serviceNames: newServiceNames });
  };

  if (!computeClient) {
    return (
      <div style={{ padding: 20 }}>
        <h3>Loading...</h3>
      </div>
    );
  }
  return (
    <div style={{ padding: 20 }}>
      <table className="table" style={{ maxWidth: 500 }}>
        <tbody>
          <tr>
            <td>Compute client</td>
            <td>
              <ComputeClientNameComponent
                computeClientId={computeClientId}
                computeClientName={computeClient.computeClientName}
              />
            </td>
            <td />
          </tr>
          <tr>
            <td>ID</td>
            <td>{computeClient.computeClientId}</td>
            <td />
          </tr>
          <tr>
            <td>User</td>
            <td>
              <UserIdComponent userId={computeClient.userId} />
            </td>
            <td />
          </tr>
          <tr>
            <td>Services</td>
            <td>
              {computeClient.serviceNames.map((sn) => (
                <>
                  <ServiceNameComponent serviceName={sn} />
                  <span>&nbsp;&nbsp;&nbsp;</span>
                </>
              ))}
              <span>
                &nbsp;
                <SmallIconButton
                  icon={<Edit />}
                  title="Edit services"
                  onClick={handleEditServices}
                />
              </span>
            </td>
          </tr>
          <tr>
            <td>Description</td>
            <td>{computeClient.description}</td>
            <td />
          </tr>
          <tr>
            <td>Compute slots</td>
            <td>
              <ComputeSlotsView
                computeSlots={computeClient.computeSlots}
                editable={true}
                onSetComputeSlots={(computeSlots) => {
                  setComputeClientInfo({ computeSlots });
                }}
              />
            </td>
            <td />
          </tr>
          <tr>
            <td>Process jobs for users</td>
            <td>
              <ProcessJobsForUsersView
                processJobsForUsers={computeClient.processJobsForUsers}
                editable={true}
                onSetProcessJobsForUsers={(processJobsForUsers) => {
                  setComputeClientInfo({ processJobsForUsers });
                }}
              />
            </td>
          </tr>
          <tr>
            <td>Last active</td>
            <td>{timeAgoString(computeClient.timestampLastActiveSec)}</td>
          </tr>
        </tbody>
      </table>
      <hr />
      To run your compute client, change to the compute client directory and run
      "pairio start-compute-client" and leave the terminal open. On a remote
      machine, you may want to use tmux or screen.
      <hr />
      {/* <div>
                {errorMessage && (
                    <div style={{color: 'red'}}>
                        {errorMessage}
                    </div>
                )}
            </div> */}
      <h3>Jobs</h3>
      <JobsView computeClientId={computeClientId} />
      <hr />
      <div>
        {/* Delete computeClient */}
        <button
          onClick={async () => {
            if (
              !window.confirm(
                `Delete computeClient ${computeClient.computeClientName}?`,
              )
            )
              return;
            await deleteComputeClient();
            setRoute({ page: "home" });
          }}
        >
          Delete compute client
        </button>
      </div>
    </div>
  );
};

type ComputeSlotsViewProps = {
  computeSlots: ComputeClientComputeSlot[];
  editable: boolean;
  onSetComputeSlots: (computeSlots: ComputeClientComputeSlot[]) => void;
};

const ComputeSlotsView: FunctionComponent<ComputeSlotsViewProps> = ({
  computeSlots,
  editable,
  onSetComputeSlots,
}) => {
  const [editing, setEditing] = useState<boolean>(false);
  const [editedYaml, setEditedYaml] = useState<string>("");
  useEffect(() => {
    if (!editable) {
      setEditing(false);
    }
  }, [editable]);
  const computeSlotsYaml = useMemo(() => {
    return jsonToYaml(computeSlots);
  }, [computeSlots]);
  useEffect(() => {
    setEditedYaml(computeSlotsYaml);
  }, [computeSlotsYaml]);
  if (editing) {
    return (
      <div>
        <div>
          <SmallIconButton
            icon={<Save />}
            title="Save compute slots"
            onClick={() => {
              const slots = yaml.load(editedYaml);
              if (!isArrayOf(isComputeClientComputeSlot)(slots)) {
                alert("Invalid compute slots");
                return;
              }
              onSetComputeSlots(slots as ComputeClientComputeSlot[]);
              setEditing(false);
            }}
          />
        </div>
        <div>
          <textarea
            value={editedYaml}
            onChange={(evt) => {
              setEditedYaml(evt.target.value);
            }}
            style={{ width: "100%", height: 200 }}
          />
        </div>
      </div>
    );
  } else {
    return (
      <div>
        {editable && (
          <div>
            {!editing && (
              <SmallIconButton
                icon={<Edit />}
                title="Edit compute slots"
                onClick={() => {
                  setEditing(true);
                }}
              />
            )}
          </div>
        )}
        <pre>{jsonToYaml(computeSlots)}</pre>
      </div>
    );
  }
};

type ProcessJobsForUsersViewProps = {
  processJobsForUsers: string[] | undefined | null;
  editable: boolean;
  onSetProcessJobsForUsers: (processJobsForUsers: string[] | null) => void;
};

const ProcessJobsForUsersView: FunctionComponent<
  ProcessJobsForUsersViewProps
> = ({ processJobsForUsers, editable, onSetProcessJobsForUsers }) => {
  const [editing, setEditing] = useState<boolean>(false);
  // editedText is \n-separated list of user IDs. Empty means process for all users. "*none*" means for no users
  const [editedText, setEditedText] = useState<string>("");
  useEffect(() => {
    if (!editable) {
      setEditing(false);
    }
  }, [editable]);
  const text = useMemo(() => {
    if (processJobsForUsers === undefined || processJobsForUsers === null) {
      return "";
    } else if (processJobsForUsers.length === 0) {
      return "*none*";
    } else {
      return processJobsForUsers.join("\n");
    }
  }, [processJobsForUsers]);
  useEffect(() => {
    setEditedText(text);
  }, [text]);
  if (editing) {
    return (
      <div>
        <div>
          <SmallIconButton
            icon={<Save />}
            title="Save process jobs for users"
            onClick={() => {
              const lines = editedText
                .split("\n")
                .map((x) => x.trim())
                .filter((x) => !!x);
              if (lines.length === 1 && lines[0] === "*none*") {
                onSetProcessJobsForUsers([]);
              } else if (lines.length > 0) {
                const userIds = lines.map((x) => {
                  if (!x.startsWith("github|")) {
                    return "github|" + x;
                  } else {
                    return x;
                  }
                });
                onSetProcessJobsForUsers(userIds);
              } else {
                onSetProcessJobsForUsers(null);
              }
              setEditing(false);
            }}
          />
        </div>
        <div>
          <p>
            Use GitHub IDs. One user ID per line. Empty means process for all
            users. "*none*" means for no users.
          </p>
          <textarea
            value={editedText}
            onChange={(evt) => {
              setEditedText(evt.target.value);
            }}
            style={{ width: "100%", height: 200 }}
          />
        </div>
      </div>
    );
  } else {
    return (
      <div>
        {editable && (
          <div>
            {!editing && (
              <SmallIconButton
                icon={<Edit />}
                title="Edit process jobs for users"
                onClick={() => {
                  setEditing(true);
                }}
              />
            )}
          </div>
        )}
        <div>
          {processJobsForUsers === undefined || processJobsForUsers === null ? (
            <span>All users</span>
          ) : processJobsForUsers.length === 0 ? (
            <span>No users</span>
          ) : (
            processJobsForUsers.join(", ")
          )}
        </div>
      </div>
    );
  }
};

const jsonToYaml = (x: any) => {
  return yaml.dump(x);
};

export default ComputeClientPage;
