import { Hyperlink } from "@fi-sci/misc";
import { Splitter } from "@fi-sci/splitter";
import {
  FunctionComponent,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useState,
} from "react";
import { useServiceApp, useServiceApps, useServices } from "../../hooks";
import {
  DendroAppProcessorOutputFile,
  DendroJob,
  DendroJobDefinition,
  DendroJobRequiredResources,
  isDendroJobDefinition,
} from "../../types";
import useRoute from "../../useRoute";
import EditJobDefinitionWindow from "./EditJobDefinitionWindow/EditJobDefinitionWindow";
import submitJob, { findJobByDefinition, getJob } from "./submitJob";
import JobView from "../JobPage/JobView";

type PlaygroundPageProps = {
  width: number;
  height: number;
};

type PlaygroundState = {
  dendroApiKey?: string;
};

type PlaygroundAction = {
  type: "set_string";
  key: "dendroApiKey";
  value: string | undefined;
};

const playgroundReducer = (
  state: PlaygroundState | undefined,
  action: PlaygroundAction,
): PlaygroundState | undefined => {
  switch (action.type) {
    case "set_string": {
      const new_state = { ...state };
      new_state[action.key] = action.value;
      return new_state;
    }
    default: {
      return state;
    }
  }
};

const defaultRequiredResources: DendroJobRequiredResources = {
  numCpus: 1,
  numGpus: 0,
  memoryGb: 4,
  timeSec: 60 * 30,
};

const PlaygroundPage: FunctionComponent<PlaygroundPageProps> = ({
  width,
  height,
}) => {
  return (
    <Splitter
      direction="horizontal"
      width={width}
      height={height}
      initialPosition={width / 2}
    >
      <LeftPanel width={0} height={0} />
      <RightPanel width={0} height={0} />
    </Splitter>
  );
};

const LeftPanel: FunctionComponent<PlaygroundPageProps> = ({
  width,
  height,
}) => {
  const { route, setRoute } = useRoute();
  if (route.page !== "playground") {
    throw new Error("Invalid route");
  }
  const {
    serviceName,
    appName,
    processorName,
    jobDefinition: jobDefinitionFromRoute,
    jobId,
  } = route;
  const [state, dispatch] = useReducer(playgroundReducer, undefined);
  useLocalStorage(state, dispatch);
  const [job, setJob] = useState<DendroJob | undefined>(undefined);
  const setJobId = useCallback(
    (jobId: string | undefined) => {
      setRoute({ ...route, jobId });
    },
    [route, setRoute],
  );

  useEffect(() => {
    let cancelled = false;
    if (!jobId) return;
    if (job && job.jobId === jobId) return;
    setJob(undefined); // loading
    getJob({ jobId }).then((j) => {
      if (cancelled) return;
      setJob(j);
    });
    return () => {
      cancelled = true;
    };
  }, [jobId, job]);

  const [requiredResources, setRequiredResources] =
    useState<DendroJobRequiredResources>(defaultRequiredResources);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmitJob = useCallback(
    async (o: { noSubmit: boolean }) => {
      try {
        const dendroApiKey = state?.dendroApiKey;
        if (!o.noSubmit && !dendroApiKey) {
          throw Error("Dendro API key is not set");
        }
        if (!serviceName) {
          throw Error("Unexpected: no serviceName");
        }
        if (jobDefinitionFromRoute.appName !== appName) {
          throw Error("Inconsistent appName");
        }
        if (jobDefinitionFromRoute.processorName !== processorName) {
          throw Error("Inconsistent appName");
        }
        if (!o.noSubmit) {
          const j = await submitJob({
            jobDefinition: jobDefinitionFromRoute,
            dendroApiKey,
            serviceName,
            requiredResources,
          });
          setJobId(j.jobId);
          setJob(j);
        } else {
          const j = await findJobByDefinition({
            jobDefinition: jobDefinitionFromRoute,
            serviceName,
          });
          setJobId(j ? j.jobId : undefined);
          setJob(j);
        }
      } catch (err: any) {
        alert(`Error: ${err.message}`);
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      state?.dendroApiKey,
      jobDefinitionFromRoute,
      serviceName,
      appName,
      processorName,
      setJobId,
      requiredResources,
    ],
  );

  const handleRefreshJob = useCallback(async () => {
    if (!job) return;
    try {
      const j = await getJob({ jobId: job.jobId });
      setJob(j);
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  }, [job]);

  useEffect(() => {
    // job does not match job definition, clear the job
    if (!job) return;
    if (!jobDefinitionFromRoute) {
      setJobId(undefined);
      setJob(undefined);
      return;
    }
    if (!jobDefinitionsMatch(jobDefinitionFromRoute, job.jobDefinition)) {
      setJobId(undefined);
      setJob(undefined);
    }
  }, [job, jobDefinitionFromRoute, setJobId]);

  if (!state) return <div>Loading...</div>;
  return (
    <div style={{ position: "absolute", width, height, overflowY: "auto" }}>
      <div style={{ padding: 20 }}>
        <h1>Dendro Playground</h1>
        <p>
          DENDRO API KEY:&nbsp;
          <DendroApiKeyInput
            value={state.dendroApiKey}
            onChange={(dendroApiKey) => {
              dispatch({
                type: "set_string",
                key: "dendroApiKey",
                value: dendroApiKey,
              });
            }}
          />
          {!state.dendroApiKey && (
            <span>
              &nbsp;
              <Hyperlink
                onClick={() => {
                  setRoute({ page: "settings" });
                }}
              >
                Reset API Key
              </Hyperlink>
            </span>
          )}
        </p>
        <table className="table" style={{ maxWidth: 400 }}>
          <tbody>
            <tr>
              <td>Service</td>
              <td>
                <ServiceSelector
                  serviceName={serviceName}
                  onChange={(newServiceName) => {
                    setRoute({ ...route, serviceName: newServiceName });
                  }}
                />
              </td>
            </tr>
            {serviceName && (
              <tr>
                <td>App</td>
                <td>
                  <AppSelector
                    serviceName={serviceName}
                    appName={appName}
                    onChange={(newAppName) => {
                      setRoute({ ...route, appName: newAppName });
                    }}
                  />
                </td>
              </tr>
            )}
            {serviceName && appName && (
              <tr>
                <td>Processor</td>
                <td>
                  <ProcessorSelector
                    serviceName={serviceName}
                    appName={appName}
                    processorName={processorName}
                    onChange={(newProcessorName) => {
                      setRoute({ ...route, processorName: newProcessorName });
                    }}
                  />
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {serviceName && appName && processorName && (
          <JobDefinitionSelector
            serviceName={serviceName}
            appName={appName}
            processorName={processorName}
            jobDefinitionFromRoute={jobDefinitionFromRoute}
            onChange={(jobDefinition) => {
              setRoute({ ...route, jobDefinition });
            }}
          />
        )}
        {serviceName && appName && processorName && jobDefinitionFromRoute && (
          <div>
            <button onClick={() => setIsSubmitting(true)}>SUBMIT JOB</button>
            &nbsp;
            <button onClick={() => handleSubmitJob({ noSubmit: true })}>
              FIND JOB
            </button>
          </div>
        )}
        {serviceName && appName && processorName && isSubmitting && (
          <RequiredResourcesSelector
            requiredResources={requiredResources}
            onChange={(requiredResources) => {
              setRequiredResources(requiredResources);
            }}
            onOkay={() => {
              handleSubmitJob({ noSubmit: false });
            }}
            onCancel={() => setIsSubmitting(false)}
          />
        )}
        <hr />
        {serviceName && appName && processorName && job && (
          <JobView
            width={width}
            height={800}
            job={job}
            refreshJob={handleRefreshJob}
            deleteJob={undefined}
          />
        )}
      </div>
    </div>
  );
};

type RightPanelProps = {
  width: number;
  height: number;
};

const RightPanel: FunctionComponent<RightPanelProps> = () => {
  const { route, setRoute } = useRoute();
  if (route.page !== "playground") {
    throw new Error("Invalid route");
  }
  const { title, notes } = route;
  return (
    <div style={{ padding: 20 }}>
      <EditTitleComponent
        title={title}
        onChange={(title) => {
          setRoute({ ...route, title });
        }}
      />
      <div>&nbsp;</div>
      <EditNotesComponent
        notes={notes}
        onChange={(notes) => {
          setRoute({ ...route, notes });
        }}
      />
    </div>
  );
};

type EditTitleComponentProps = {
  title?: string;
  onChange: (title: string) => void;
};

const EditTitleComponent: FunctionComponent<EditTitleComponentProps> = ({
  title,
  onChange,
}) => {
  const [internalValue, setInternalValue] = useState(title || "");
  useEffect(() => {
    setInternalValue(title || "");
  }, [title]);
  return (
    <div>
      <div>Title:</div>
      <input
        value={internalValue}
        onChange={(evt) => {
          setInternalValue(evt.target.value);
        }}
        style={{ width: "100%" }}
      />
      <br />
      <button onClick={() => onChange(internalValue)}>Set</button>
    </div>
  );
};

type EditNotesComponentProps = {
  notes?: string;
  onChange: (notes: string) => void;
};

const EditNotesComponent: FunctionComponent<EditNotesComponentProps> = ({
  notes,
  onChange,
}) => {
  const [internalValue, setInternalValue] = useState(notes || "");
  useEffect(() => {
    setInternalValue(notes || "");
  }, [notes]);
  return (
    <div>
      <div>Notes:</div>
      <textarea
        value={internalValue}
        onChange={(evt) => {
          setInternalValue(evt.target.value);
        }}
        style={{ width: "100%", height: 200 }}
      />
      <br />
      <button onClick={() => onChange(internalValue)}>Set</button>
    </div>
  );
};

type ServiceSelectorProps = {
  serviceName?: string;
  onChange: (serviceName?: string) => void;
};

const ServiceSelector: FunctionComponent<ServiceSelectorProps> = ({
  serviceName,
  onChange,
}) => {
  const { services } = useServices();
  if (!services) return <div>Loading services...</div>;
  return (
    <div>
      <select
        value={serviceName || ""}
        onChange={(evt) => onChange(evt.target.value || undefined)}
      >
        <option value={""}>Select a service</option>
        {services.map((service) => (
          <option key={service.serviceName} value={service.serviceName}>
            {service.serviceName}
          </option>
        ))}
      </select>
    </div>
  );
};

type AppSelectorProps = {
  serviceName: string;
  appName?: string;
  onChange: (appName?: string) => void;
};

const AppSelector: FunctionComponent<AppSelectorProps> = ({
  serviceName,
  appName,
  onChange,
}) => {
  const { serviceApps } = useServiceApps(serviceName);
  useEffect(() => {
    // if the app is not in the service, then clear it
    if (!serviceName) return;
    if (!serviceApps) return;
    if (!appName) return;
    if (!serviceApps.find((app) => app.appName === appName)) {
      onChange(undefined);
    }
  }, [serviceName, serviceApps, appName, onChange]);
  if (!serviceName) return <div>Select a service</div>;
  if (!serviceApps) return <div>Loading service apps...</div>;
  return (
    <div>
      <select
        value={appName || ""}
        onChange={(evt) => onChange(evt.target.value || undefined)}
      >
        <option value={""}>Select an app</option>
        {serviceApps.map((app) => (
          <option key={app.appName} value={app.appName}>
            {app.appName}
          </option>
        ))}
      </select>
    </div>
  );
};

type ProcessorSelectorProps = {
  serviceName: string;
  appName: string;
  processorName?: string;
  onChange: (processorName?: string) => void;
};

const ProcessorSelector: FunctionComponent<ProcessorSelectorProps> = ({
  serviceName,
  appName,
  processorName,
  onChange,
}) => {
  const { serviceApp } = useServiceApp(serviceName, appName);
  useEffect(() => {
    // if the processor is not in the app, then clear it
    if (!serviceName) return;
    if (!appName) return;
    if (!serviceApp) return;
    if (!processorName) return;
    if (
      !serviceApp.appSpecification.processors.find(
        (processor) => processor.name === processorName,
      )
    ) {
      onChange(undefined);
    }
  }, [serviceName, appName, serviceApp, processorName, onChange]);
  if (!serviceName) return <div>Select a service</div>;
  if (!appName) return <div>Select an app</div>;
  if (!serviceApp) return <div>Loading service app...</div>;
  return (
    <div>
      <select
        value={processorName || ""}
        onChange={(evt) => onChange(evt.target.value || undefined)}
      >
        <option value={""}>Select a processor</option>
        {serviceApp.appSpecification.processors.map((processor) => (
          <option key={processor.name} value={processor.name}>
            {processor.name}
          </option>
        ))}
      </select>
    </div>
  );
};

type JobDefinitionSelectorProps = {
  serviceName: string;
  appName: string;
  processorName: string;
  jobDefinitionFromRoute?: DendroJobDefinition;
  onChange: (jobDefinition: DendroJobDefinition) => void;
};

const JobDefinitionSelector: FunctionComponent<JobDefinitionSelectorProps> = ({
  serviceName,
  appName,
  processorName,
  jobDefinitionFromRoute,
  onChange,
}) => {
  const jobDefinitionFromRoute2 = isDendroJobDefinition(jobDefinitionFromRoute)
    ? jobDefinitionFromRoute
    : undefined;
  const { serviceApp } = useServiceApp(serviceName, appName);
  const processor = useMemo(
    () =>
      (serviceApp &&
        serviceApp.appSpecification.processors.find(
          (p) => p.name === processorName,
        )) ||
      undefined,
    [serviceApp, processorName],
  );
  const jobDefinition = useMemo(() => {
    if (!serviceApp) return undefined;
    if (!processor) return undefined;
    const jd: DendroJobDefinition = {
      appName,
      processorName,
      inputFiles: [],
      outputFiles: [],
      parameters: [],
      cacheBust: undefined,
    };

    for (const ii of processor.inputs) {
      const x =
        jobDefinitionFromRoute2 &&
        jobDefinitionFromRoute2.inputFiles.find((jd) => jd.name === ii.name);
      if (x) {
        jd.inputFiles.push(x);
      } else {
        jd.inputFiles.push({ name: ii.name, url: "", fileBaseName: "" });
      }
    }
    for (const oo of processor.outputs) {
      const x =
        jobDefinitionFromRoute2 &&
        jobDefinitionFromRoute2.outputFiles.find((jd) => jd.name === oo.name);
      if (x) {
        jd.outputFiles.push(x);
      } else {
        jd.outputFiles.push({
          name: oo.name,
          fileBaseName: determineDefaultFileBaseName(oo),
        });
      }
    }
    for (const pp of processor.parameters) {
      const x =
        jobDefinitionFromRoute2 &&
        jobDefinitionFromRoute2.parameters.find((jd) => jd.name === pp.name);
      if (x) {
        jd.parameters.push(x);
      } else {
        jd.parameters.push({ name: pp.name, value: pp.defaultValue ?? null });
      }
    }
    return jd;
  }, [jobDefinitionFromRoute2, serviceApp, appName, processorName, processor]);

  useEffect(() => {
    if (!jobDefinition) return;
    if (!jobDefinitionsMatch(jobDefinition, jobDefinitionFromRoute)) {
      onChange(jobDefinition);
    }
  }, [jobDefinition, jobDefinitionFromRoute, onChange]);

  if (!jobDefinition || !processor) return <div />;
  return (
    <EditJobDefinitionWindow
      jobDefinition={jobDefinition}
      setJobDefinition={onChange}
      processor={processor}
    />
  );
};

const jobDefinitionsMatch = (
  jd1: DendroJobDefinition | undefined,
  jd2: DendroJobDefinition | undefined,
) => {
  if (jd1 === undefined || jd2 === undefined) {
    return jd1 === jd2;
  }
  const x = normalizeJobDefinition(jd1);
  const y = normalizeJobDefinition(jd2);
  return JSONStringifyDeterministic(x) === JSONStringifyDeterministic(y);
};

const useLocalStorage = (
  state: PlaygroundState | undefined,
  dispatch: (action: PlaygroundAction) => void,
) => {
  useEffect(() => {
    const json = localStorage.getItem("dendro-playground-state");
    if (!json) {
      dispatch({ type: "set_string", key: "dendroApiKey", value: undefined });
      return;
    }
    const obj = JSON.parse(json);
    if (typeof obj.dendroApiKey === "string") {
      dispatch({
        type: "set_string",
        key: "dendroApiKey",
        value: obj.dendroApiKey,
      });
      return;
    }
    dispatch({ type: "set_string", key: "dendroApiKey", value: undefined });
  }, [dispatch]);
  useEffect(() => {
    if (!state) return;
    localStorage.setItem("dendro-playground-state", JSON.stringify(state));
  }, [state]);
};

type RequiredResourcesSelectorProps = {
  requiredResources: DendroJobRequiredResources;
  onChange: (requiredResources: DendroJobRequiredResources) => void;
  onOkay: () => void;
  onCancel: () => void;
};

const RequiredResourcesSelector: FunctionComponent<
  RequiredResourcesSelectorProps
> = ({ requiredResources, onChange, onOkay, onCancel }) => {
  return (
    <div>
      <h3>Select required Resources</h3>
      <table className="table">
        <tbody>
          <tr>
            <td>Num. CPUs</td>
            <td>
              <InputNumber
                value={requiredResources.numCpus}
                onChange={(numCpus) => {
                  onChange({ ...requiredResources, numCpus });
                }}
                choices={[1, 2, 4, 8, 16]}
              />
            </td>
          </tr>
          <tr>
            <td>Num. GPUs</td>
            <td>
              <InputNumber
                value={requiredResources.numGpus}
                onChange={(numGpus) => {
                  onChange({ ...requiredResources, numGpus });
                }}
                choices={[0, 1]}
              />
            </td>
          </tr>
          <tr>
            <td>Memory (GB)</td>
            <td>
              <InputNumber
                value={requiredResources.memoryGb}
                onChange={(memoryGb) => {
                  onChange({ ...requiredResources, memoryGb });
                }}
                choices={[1, 2, 4, 8, 16, 32, 64, 128]}
              />
            </td>
          </tr>
          <tr>
            <td>Time (minutes)</td>
            <td>
              <InputNumber
                value={requiredResources.timeSec / 60}
                onChange={(timeMin) => {
                  onChange({ ...requiredResources, timeSec: timeMin * 60 });
                }}
                choices={[5, 10, 30, 60, 120, 240, 480, 960]}
              />
            </td>
          </tr>
        </tbody>
      </table>
      <div>
        <button onClick={onOkay}>OK</button>
        &nbsp;
        <button onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
};

type InputNumberProps = {
  value: number;
  onChange: (value: number) => void;
  choices: number[];
};

const InputNumber: FunctionComponent<InputNumberProps> = ({
  value,
  onChange,
  choices,
}) => {
  return (
    <select
      value={value}
      onChange={(evt) => onChange(Number(evt.target.value))}
    >
      {choices.map((choice) => (
        <option key={choice} value={choice}>
          {choice}
        </option>
      ))}
    </select>
  );
};

type DendroApiKeyInputProps = {
  value?: string;
  onChange: (value: string) => void;
};

const DendroApiKeyInput: FunctionComponent<DendroApiKeyInputProps> = ({
  value,
  onChange,
}) => {
  return (
    <input
      type="password"
      value={value || ""}
      onChange={(evt) => onChange(evt.target.value)}
    />
  );
};

const normalizeJobDefinition = (jobDefinition: DendroJobDefinition) => {
  return {
    ...jobDefinition,
    inputFiles: orderByName(jobDefinition.inputFiles),
    outputFiles: orderByName(jobDefinition.outputFiles),
    parameters: orderByName(jobDefinition.parameters),
  };
};

const orderByName = (arr: any[]) => {
  return arr.sort((a, b) => a.name.localeCompare(b.name));
};

// Thanks: https://stackoverflow.com/questions/16167581/sort-object-properties-and-json-stringify
export const JSONStringifyDeterministic = (
  obj: any,
  space: string | number | undefined = undefined,
) => {
  const allKeys: string[] = [];
  JSON.stringify(obj, function (key, value) {
    allKeys.push(key);
    return value;
  });
  allKeys.sort();
  return JSON.stringify(obj, allKeys, space);
};

const determineDefaultFileBaseName = (oo: DendroAppProcessorOutputFile) => {
  const words = oo.description.split(" ");
  if (words.includes(".h5")) {
    return `${oo.name}.h5`;
  } else if (words.includes(".nwb.lindi.json")) {
    return `${oo.name}.nwb.lindi.json`;
  } else if (words.includes(".nwb.lindi.tar")) {
    return `${oo.name}.nwb.lindi.tar`;
  } else if (words.includes(".lindi.json")) {
    return `${oo.name}.lindi.json`;
  } else if (words.includes(".lindi.tar")) {
    return `${oo.name}.lindi.tar`;
  } else if (words.includes(".json")) {
    return `${oo.name}.json`;
  } else if (words.includes(".txt")) {
    return `${oo.name}.txt`;
  } else if (words.includes(".csv")) {
    return `${oo.name}.csv`;
  } else if (words.includes(".png")) {
    return `${oo.name}.png`;
  } else {
    return `${oo.name}`;
  }
};

export default PlaygroundPage;
