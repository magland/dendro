/* eslint-disable @typescript-eslint/no-explicit-any */
import { faCaretDown, faCaretRight } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  FunctionComponent,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useState,
} from "react";
import {
  PairioAppProcessor,
  PairioAppProcessorInputFile,
  PairioAppProcessorParameter,
  PairioJobDefinition,
} from "../../../types";
import { expandedFoldersReducer } from "./expandedFoldersReducer";
import { pairioJobDefinitionReducer } from "./pairioJobDefinitionReducer";

type EditJobDefinitionWindowProps = {
  jobDefinition: PairioJobDefinition;
  setJobDefinition: (jobDefinition: PairioJobDefinition) => void;
  processor: PairioAppProcessor;
  readOnly?: boolean;
  show?: "inputs" | "outputs" | "parameters" | "all" | "inputs+outputs";
  setValid?: (valid: boolean) => void;
};

type ValidParametersState = {
  [key: string]: boolean;
};

type ValidParametersAction = {
  type: "setValid";
  name: string;
  valid: boolean;
};

const validParametersReducer = (
  state: ValidParametersState,
  action: ValidParametersAction,
) => {
  if (action.type === "setValid") {
    // check if no change
    if (state[action.name] === action.valid) return state;
    return {
      ...state,
      [action.name]: action.valid,
    };
  } else return state;
};

type RowNode =
  | {
      type: "leaf";
      fieldType: "input" | "output" | "parameter";
      name: string;
      description?: string | null;
    }
  | {
      type: "group";
      name: string;
    };

const EditJobDefinitionWindow: FunctionComponent<
  EditJobDefinitionWindowProps
> = ({
  jobDefinition,
  setJobDefinition,
  processor,
  readOnly,
  show = "all",
  setValid,
}) => {
  const setParameterValue = useCallback(
    (name: string, value: any) => {
      setJobDefinition(
        pairioJobDefinitionReducer(jobDefinition, {
          type: "setParameter",
          name,
          value,
        }),
      );
    },
    [jobDefinition, setJobDefinition],
  );

  const [validParameters, validParametersDispatch] = useReducer(
    validParametersReducer,
    {},
  );
  const allParametersAreValid = useMemo(() => {
    const allNames: string[] = [
      ...processor.parameters.map((p) => p.name),
      ...processor.inputs.map((i) => i.name),
      ...processor.outputs.map((o) => o.name),
    ];
    for (const name of allNames) {
      if (!validParameters[name]) {
        return false;
      }
    }
    return true;
  }, [processor, validParameters]);
  useEffect(() => {
    setValid && setValid(allParametersAreValid);
  }, [allParametersAreValid, setValid]);

  const nodes: RowNode[] = useMemo(() => {
    const nodes: RowNode[] = [];
    const addGroupNodes = (name: string) => {
      const aa = name.split(".");
      if (aa.length > 1) {
        for (let i = 0; i < aa.length - 1; i++) {
          const group = aa.slice(0, i + 1).join(".");
          if (!nodes.find((n) => n.type === "group" && n.name === group)) {
            nodes.push({
              type: "group",
              name: group,
            });
          }
        }
      }
    };
    processor.inputs.forEach((input) => {
      addGroupNodes(input.name);
      nodes.push({
        type: "leaf",
        fieldType: "input",
        name: input.name,
        description: input.description,
      });
    });
    processor.outputs.forEach((output) => {
      addGroupNodes(output.name);
      nodes.push({
        type: "leaf",
        fieldType: "output",
        name: output.name,
        description: output.description,
      });
    });
    processor.parameters.forEach((parameter) => {
      addGroupNodes(parameter.name);
      nodes.push({
        type: "leaf",
        fieldType: "parameter",
        name: parameter.name,
        description: parameter.description,
      });
    });
    return nodes;
  }, [processor]);

  const [expandedGroups, expandedGroupsDispatch] = useReducer(
    expandedFoldersReducer,
    new Set<string>(),
  );

  useEffect(() => {
    // initialize the expanded groups
    // const numInitialLevelsExpanded = 1
    const numInitialLevelsExpanded = 0;
    const groupNames = nodes
      .filter((n) => n.type === "group")
      .map((n) => n.name);
    const eg = new Set<string>();
    for (const name of groupNames) {
      const aa = name.split(".");
      if (aa.length <= numInitialLevelsExpanded) {
        eg.add(name);
      }
    }
    expandedGroupsDispatch({
      type: "set",
      paths: eg,
    });
  }, [nodes]);

  const rows = useMemo(() => {
    const ret: any[] = [];
    const showInputs =
      show === "all" || show === "inputs" || show === "inputs+outputs";
    const showOutputs =
      show === "all" || show === "outputs" || show === "inputs+outputs";
    const showParameters = show === "all" || show === "parameters";

    const getGroupHasInputs = (name: string) => {
      return nodes.find(
        (n) =>
          n.type === "leaf" &&
          n.fieldType === "input" &&
          n.name.startsWith(name + "."),
      );
    };
    const getGroupHasOutputs = (name: string) => {
      return nodes.find(
        (n) =>
          n.type === "leaf" &&
          n.fieldType === "output" &&
          n.name.startsWith(name + "."),
      );
    };
    const getGroupHasParameters = (name: string) => {
      return nodes.find(
        (n) =>
          n.type === "leaf" &&
          n.fieldType === "parameter" &&
          n.name.startsWith(name + "."),
      );
    };

    nodes.forEach((node) => {
      const aa = node.name.split(".");
      let visible = true;
      for (let i = 0; i < aa.length - 1; i++) {
        const group = aa.slice(0, i + 1).join(".");
        if (!expandedGroups.has(group)) {
          visible = false;
        }
      }
      if (node.type === "group") {
        const groupHasInputs = getGroupHasInputs(node.name);
        const groupHasOutputs = getGroupHasOutputs(node.name);
        const groupHasParameters = getGroupHasParameters(node.name);
        let okayToShow = false;
        if (showInputs && groupHasInputs) okayToShow = true;
        if (showOutputs && groupHasOutputs) okayToShow = true;
        if (showParameters && groupHasParameters) okayToShow = true;
        if (!okayToShow) return;
        ret.push(
          <GroupRow
            key={node.name}
            name={node.name}
            expanded={expandedGroups.has(node.name)}
            toggleExpanded={() => {
              expandedGroupsDispatch({
                type: "toggle",
                path: node.name,
              });
            }}
            visible={visible}
          />,
        );
      } else if (node.type === "leaf") {
        if (node.fieldType === "input") {
          if (!showInputs) return;
          const value = jobDefinition?.inputFiles.find(
            (f) => f.name === node.name,
          )?.url;
          const inputFile = processor.inputs.find((i) => i.name === node.name);
          if (!inputFile) {
            console.warn(
              `Unexpected: processor input file not found: ${node.name}`,
            );
            return;
          }
          ret.push(
            <InputRow
              key={node.name}
              inputFile={inputFile}
              url={value}
              setUrl={(url) => {
                setJobDefinition(
                  pairioJobDefinitionReducer(jobDefinition, {
                    type: "setInputFile",
                    name: node.name,
                    url,
                  }),
                );
              }}
              setValid={(valid) => {
                validParametersDispatch({
                  type: "setValid",
                  name: node.name,
                  valid,
                });
              }}
              visible={visible}
            />,
          );
        } else if (node.fieldType === "output") {
          if (!showOutputs) return;
          ret.push(
            <OutputRow
              key={node.name}
              name={node.name}
              description={node.description || ""}
              setValid={(valid) => {
                validParametersDispatch({
                  type: "setValid",
                  name: node.name,
                  valid,
                });
              }}
              visible={visible}
            />,
          );
        } else if (node.fieldType === "parameter") {
          if (!showParameters) return;
          const value = jobDefinition?.parameters.find(
            (f) => f.name === node.name,
          )?.value;
          const parameter = processor.parameters.find(
            (p) => p.name === node.name,
          );
          if (!parameter) {
            console.warn(
              `Unexpected: processor parameter not found: ${node.name}`,
            );
            return;
          }
          ret.push(
            <ParameterRow
              key={node.name}
              parameter={parameter}
              value={value}
              setValue={(value) => {
                setParameterValue(parameter.name, value);
              }}
              setValid={(valid) => {
                validParametersDispatch({
                  type: "setValid",
                  name: parameter.name,
                  valid,
                });
              }}
              readOnly={readOnly}
              visible={visible}
            />,
          );
        } else {
          throw Error("Unexpected field type");
        }
      } else {
        throw Error("Unexpected node type");
      }
    });
    return ret;
  }, [
    expandedGroups,
    jobDefinition,
    nodes,
    processor.inputs,
    processor.outputs,
    processor.parameters,
    readOnly,
    setParameterValue,
    validParametersDispatch,
    setJobDefinition,
    show,
  ]);
  return (
    <div>
      <table className="table" style={{ maxWidth: 500 }}>
        <tbody>{rows}</tbody>
      </table>
    </div>
  );
};

// minimum width that fits the content
const nameColumnStyle: React.CSSProperties = {
  width: "1%",
  whiteSpace: "nowrap",
};

type GroupRowProps = {
  name: string;
  expanded: boolean;
  toggleExpanded: () => void;
  visible?: boolean;
};

const GroupRow: FunctionComponent<GroupRowProps> = ({
  name,
  expanded,
  toggleExpanded,
  visible,
}) => {
  return (
    <tr style={{ display: visible ? undefined : "none" }}>
      <td colSpan={3} style={{ fontWeight: "bold" }}>
        <span onClick={toggleExpanded} style={{ cursor: "pointer" }}>
          {indentForName(name)}
          {expanded ? (
            <span>
              <FontAwesomeIcon icon={faCaretDown} style={{ color: "gray" }} />{" "}
            </span>
          ) : (
            <span>
              <FontAwesomeIcon icon={faCaretRight} style={{ color: "gray" }} />{" "}
            </span>
          )}
          {baseName(name)}
        </span>
      </td>
    </tr>
  );
};

type InputRowProps = {
  inputFile: PairioAppProcessorInputFile;
  url: any;
  setUrl: (url: any) => void;
  setValid: (valid: boolean) => void;
  readOnly?: boolean;
  visible?: boolean;
};

const InputRow: FunctionComponent<InputRowProps> = ({
  inputFile,
  url,
  setUrl,
  setValid,
  readOnly,
  visible,
}) => {
  const { name, description } = inputFile;
  const [isValid, setIsValid] = useState<boolean>(false);
  return (
    <tr style={{ display: visible ? undefined : "none" }}>
      <td title={`${name}`} style={nameColumnStyle}>
        <span style={{ color: readOnly || isValid ? "black" : "red" }}>
          {indentForName(name)}
          {baseName(name)}
        </span>
      </td>
      <td>
        {readOnly ? (
          <span>{url}</span>
        ) : (
          <EditUrl
            url={url}
            setUrl={setUrl}
            setValid={(valid) => {
              setIsValid(valid);
              setValid(valid);
            }}
          />
        )}
      </td>
      <td>{description}</td>
    </tr>
  );
};

type OutputRowProps = {
  name: string;
  description?: string | null;
  value?: string;
  setValid?: (valid: boolean) => void;
  fileLinks?: boolean;
  visible?: boolean;
};

const OutputRow: FunctionComponent<OutputRowProps> = ({
  name,
  description,
  visible,
}) => {
  return (
    <tr>
      <td style={{ ...nameColumnStyle, display: visible ? undefined : "none" }}>
        {indentForName(name)}
        {baseName(name)}
      </td>
      <td></td>
      <td>{description}</td>
    </tr>
  );
};

type ParameterRowProps = {
  parameter: PairioAppProcessorParameter;
  value: any;
  setValue: (value: any) => void;
  setValid: (valid: boolean) => void;
  readOnly?: boolean;
  secret?: boolean;
  visible?: boolean;
};

const ParameterRow: FunctionComponent<ParameterRowProps> = ({
  parameter,
  value,
  setValue,
  setValid,
  readOnly,
  secret,
  visible,
}) => {
  const { type, name, description } = parameter;
  const [isValid, setIsValid] = useState<boolean>(false);
  useEffect(() => {
    if (parameter.type === "bool") {
      setValid(true);
      setIsValid(true);
    }
  }, [parameter, setValid]);
  return (
    <tr style={{ display: visible ? undefined : "none" }}>
      <td title={`${name} (${type})`} style={nameColumnStyle}>
        <span style={{ color: readOnly || isValid ? "black" : "red" }}>
          {indentForName(name)}
          {baseName(name)}
        </span>
      </td>
      <td>
        {readOnly ? (
          <span>
            <DisplayParameterValue parameter={parameter} value={value} />
            {
              // we don't want to rely on the display to hide the secret
              // if it is a secret the value should be empty
              // if that's not the case, it's better that we see it here
              // so we can know there is an issue with secrets being displayed
              secret && <span style={{ color: "darkgreen" }}> (secret)</span>
            }
          </span>
        ) : (
          <EditParameterValue
            parameter={parameter}
            value={value}
            setValue={setValue}
            setValid={(valid) => {
              setIsValid(valid);
              setValid(valid);
            }}
          />
        )}
      </td>
      <td>{description}</td>
    </tr>
  );
};

type EditParameterValueProps = {
  parameter: PairioAppProcessorParameter;
  value: any;
  setValue: (value: any) => void;
  setValid: (valid: boolean) => void;
};

const EditParameterValue: FunctionComponent<EditParameterValueProps> = ({
  parameter,
  value,
  setValue,
  setValid,
}) => {
  const { type } = parameter;
  if (parameter.options) {
    return (
      <SelectEdit
        value={value}
        setValue={setValue}
        setValid={setValid}
        options={parameter.options}
      />
    );
  } else if (type === "str") {
    setValid(true);
    return (
      <input
        type="text"
        value={value || ""}
        onChange={(evt) => {
          setValue(evt.target.value);
        }}
        style={{ width: 250 }}
      />
    );
  } else if (type === "int") {
    return <IntEdit value={value} setValue={setValue} setValid={setValid} />;
  } else if (type === "Optional[int]") {
    return (
      <IntEdit
        value={value}
        setValue={setValue}
        setValid={setValid}
        optional={true}
      />
    );
  } else if (type === "float") {
    return <FloatEdit value={value} setValue={setValue} setValid={setValid} />;
  } else if (type === "Optional[float]") {
    return (
      <FloatEdit
        value={value}
        setValue={setValue}
        setValid={setValid}
        optional={true}
      />
    );
  } else if (type === "bool") {
    return (
      <input
        type="checkbox"
        checked={value || false}
        onChange={(evt) => {
          setValue(evt.target.checked ? true : false);
        }}
      />
    );
  } else if (type === "List[int]") {
    return (
      <IntListEdit value={value} setValue={setValue} setValid={setValid} />
    );
  } else if (type === "List[float]") {
    return (
      <FloatListEdit value={value} setValue={setValue} setValid={setValid} />
    );
  } else if (type === "List[str]") {
    return (
      <StringListEdit value={value} setValue={setValue} setValid={setValid} />
    );
  } else {
    return <div>Unsupported type: {type}</div>;
  }
};

type EditUrlProps = {
  url: string;
  setUrl: (url: string) => void;
  setValid: (valid: boolean) => void;
};

const EditUrl: FunctionComponent<EditUrlProps> = ({
  url,
  setUrl,
  setValid,
}) => {
  useEffect(() => {
    if (!url) setValid(false);
    setValid(true);
  }, [setValid, url]);
  return (
    <input
      type="text"
      value={url}
      onChange={(evt) => {
        setUrl(evt.target.value);
      }}
      style={{ width: 250 }}
    />
  );
};

type SelectEditProps = {
  value: any;
  setValue: (value: any) => void;
  setValid: (valid: boolean) => void;
  options: any[];
};

const SelectEdit: FunctionComponent<SelectEditProps> = ({
  value,
  setValue,
  setValid,
  options,
}) => {
  const isValid = useMemo(() => {
    return options.includes(value);
  }, [value, options]);
  useEffect(() => {
    setValid(isValid);
  }, [isValid, setValid]);
  return (
    <select
      value={value || ""}
      onChange={(evt) => {
        for (const option of options) {
          if (option + "" === evt.target.value) {
            setValue(option);
            return;
          }
        }
      }}
    >
      {options.map((option) => (
        <option key={option} value={option + ""}>
          {option}
        </option>
      ))}
    </select>
  );
};

type FloatEditProps = {
  value: any;
  setValue: (value: number | null) => void;
  setValid: (valid: boolean) => void;
  optional?: boolean;
};

const FloatEdit: FunctionComponent<FloatEditProps> = ({
  value,
  setValue,
  setValid,
  optional,
}) => {
  const [internalValue, setInternalValue] = useState<string | undefined>(
    undefined,
  ); // value of undefined corresponds to internalValue of ''
  useEffect(() => {
    if (value === undefined && optional) {
      setInternalValue("");
    } else {
      if (isFloatType(value)) {
        setInternalValue((old) => {
          if (
            old !== undefined &&
            stringIsValidFloat(old) &&
            parseFloat(old) === value
          ) {
            return old;
          }
          return `${value}`;
        });
      }
    }
  }, [value, optional]);

  const handleChange = useCallback(
    (newString: string) => {
      if (stringIsValidFloat(newString)) {
        const newValue = parseFloat(newString);
        if (newValue === value) return;
        setValue(newValue);
      }
      setInternalValue(newString);
    },
    [setValue, value],
  );

  const isValid = useMemo(() => {
    if (internalValue === undefined) return false;
    if (optional && internalValue === "") return true;
    return stringIsValidFloat(internalValue);
  }, [internalValue, optional]);

  useEffect(() => {
    setValid(isValid);
  }, [isValid, setValid]);

  return (
    <span className="FloatEdit">
      <input
        type="text"
        value={internalValue || ""}
        onChange={(evt) => {
          handleChange(evt.target.value);
        }}
        style={numInputStyle}
      />
      {isValid ? null : <span style={{ color: "red" }}>x</span>}
      {isValid ? null : <span style={{ color: "red" }}>x</span>}
    </span>
  );
};

const isFloatType = (x: any) => {
  return typeof x === "number" && !isNaN(x);
};

function stringIsValidFloat(s: string) {
  const floatRegex = /^[-+]?[0-9]*\.?[0-9]+([eE][-+]?[0-9]+)?$/;
  return floatRegex.test(s);
}

type IntEditProps = {
  value: any;
  setValue: (value: number | null) => void;
  setValid: (valid: boolean) => void;
  optional?: boolean;
};

const IntEdit: FunctionComponent<IntEditProps> = ({
  value,
  setValue,
  setValid,
  optional,
}) => {
  const [internalValue, setInternalValue] = useState<string | undefined>(
    undefined,
  ); // value of undefined corresponds to internalValue of ''
  useEffect(() => {
    if (value === undefined && optional) {
      setInternalValue("");
    } else {
      if (isIntType(value)) {
        setInternalValue((old) => {
          if (
            old !== undefined &&
            stringIsValidInt(old) &&
            parseInt(old) === value
          ) {
            return old;
          }
          return `${value}`;
        });
      }
    }
  }, [value, optional]);

  const handleChange = useCallback(
    (newString: string) => {
      if (stringIsValidInt(newString)) {
        const newValue = parseInt(newString);
        if (newValue === value) return;
        setValue(newValue);
      }
      setInternalValue(newString);
    },
    [setValue, value],
  );

  const isValid = useMemo(() => {
    if (internalValue === undefined) return false;
    if (optional && internalValue === "") return true;
    return stringIsValidInt(internalValue);
  }, [internalValue, optional]);

  useEffect(() => {
    setValid(isValid);
  }, [isValid, setValid]);

  return (
    <span className="IntEdit">
      <input
        type="text"
        value={internalValue || ""}
        onChange={(evt) => {
          handleChange(evt.target.value);
        }}
        style={numInputStyle}
      />
      {isValid ? null : <span style={{ color: "red" }}>x</span>}
      {isValid ? null : <span style={{ color: "red" }}>x</span>}
    </span>
  );
};

const isIntType = (x: any) => {
  return typeof x === "number" && !isNaN(x) && Math.floor(x) === x;
};

function stringIsValidInt(s: string) {
  const intRegex = /^[-+]?[0-9]+$/;
  return intRegex.test(s);
}

const numInputStyle = {
  width: 60,
};

type IntListEditProps = {
  value: any;
  setValue: (value: any) => void;
  setValid: (valid: boolean) => void;
};

const isIntListType = (x: any) => {
  if (!Array.isArray(x)) return false;
  for (let i = 0; i < x.length; i++) {
    if (!isIntType(x[i])) return false;
  }
  return true;
};

function intListToString(x: number[]) {
  return x.join(", ");
}

function stringToIntList(s: string) {
  return s.split(",").map((x) => parseInt(x.trim()));
}

function stringIsValidIntList(s: string) {
  const intListRegex = /^[-+]?[0-9]+(,\s*[-+]?[0-9]+)*$/;
  return intListRegex.test(s);
}

const IntListEdit: FunctionComponent<IntListEditProps> = ({
  value,
  setValue,
  setValid,
}) => {
  const [internalValue, setInternalValue] = useState<string | undefined>(
    undefined,
  ); // value of undefined corresponds to internalValue of ''
  useEffect(() => {
    if (isIntListType(value)) {
      setInternalValue((old) => {
        if (
          old !== undefined &&
          stringIsValidIntList(old) &&
          intListToString(stringToIntList(old)) === intListToString(value)
        ) {
          return old;
        }
        return `${value}`;
      });
    }
  }, [value]);

  const handleChange = useCallback(
    (newString: string) => {
      if (stringIsValidIntList(newString)) {
        const newValue = stringToIntList(newString);
        if (intListToString(newValue) === intListToString(value)) return;
        setValue(newValue);
      }
      setInternalValue(newString);
    },
    [setValue, value],
  );

  const isValid = useMemo(() => {
    if (internalValue === undefined) return false;
    return stringIsValidIntList(internalValue);
  }, [internalValue]);

  useEffect(() => {
    setValid(isValid);
  }, [isValid, setValid]);

  return (
    <span className="IntListEdit">
      <input
        type="text"
        value={internalValue || ""}
        onChange={(evt) => {
          handleChange(evt.target.value);
        }}
        style={numInputStyle}
      />
      {isValid ? null : <span style={{ color: "red" }}>x</span>}
      {isValid ? null : <span style={{ color: "red" }}>x</span>}
    </span>
  );
};

type FloatListEditProps = {
  value: any;
  setValue: (value: any) => void;
  setValid: (valid: boolean) => void;
};

const isFloatListType = (x: any) => {
  if (!Array.isArray(x)) return false;
  for (let i = 0; i < x.length; i++) {
    if (!isFloatType(x[i])) return false;
  }
  return true;
};

function floatListToString(x: number[]) {
  return x.join(", ");
}

function stringToFloatList(s: string) {
  return s.split(",").map((x) => parseFloat(x.trim()));
}

function stringIsValidFloatList(s: string) {
  const floatListRegex =
    /^[-+]?[0-9]*\.?[0-9]+([eE][-+]?[0-9]+)?(,\s*[-+]?[0-9]*\.?[0-9]+([eE][-+]?[0-9]+)?)*$/;
  return floatListRegex.test(s);
}

const FloatListEdit: FunctionComponent<FloatListEditProps> = ({
  value,
  setValue,
  setValid,
}) => {
  const [internalValue, setInternalValue] = useState<string | undefined>(
    undefined,
  ); // value of undefined corresponds to internalValue of ''
  useEffect(() => {
    if (isFloatListType(value)) {
      setInternalValue((old) => {
        if (
          old !== undefined &&
          stringIsValidFloatList(old) &&
          floatListToString(stringToFloatList(old)) === floatListToString(value)
        ) {
          return old;
        }
        return `${value}`;
      });
    }
  }, [value]);

  const handleChange = useCallback(
    (newString: string) => {
      if (stringIsValidFloatList(newString)) {
        const newValue = stringToFloatList(newString);
        if (floatListToString(newValue) === floatListToString(value)) return;
        setValue(newValue);
      }
      setInternalValue(newString);
    },
    [setValue, value],
  );

  const isValid = useMemo(() => {
    if (internalValue === undefined) return false;
    return stringIsValidFloatList(internalValue);
  }, [internalValue]);

  useEffect(() => {
    setValid(isValid);
  }, [isValid, setValid]);

  return (
    <span className="FloatListEdit">
      <input
        type="text"
        value={internalValue || ""}
        onChange={(evt) => {
          handleChange(evt.target.value);
        }}
        style={numInputStyle}
      />
      {isValid ? null : <span style={{ color: "red" }}>x</span>}
      {isValid ? null : <span style={{ color: "red" }}>x</span>}
    </span>
  );
};

type StringListEditProps = {
  value: any;
  setValue: (value: any) => void;
  setValid: (valid: boolean) => void;
};

const isStringListType = (x: any) => {
  if (!Array.isArray(x)) return false;
  for (let i = 0; i < x.length; i++) {
    if (typeof x[i] !== "string") return false;
  }
  return true;
};

function stringListToString(x: string[]) {
  return x.join(", ");
}

function stringToStringList(s: string) {
  return s.split(",").map((x) => x.trim());
}

function stringIsValidStringList(s: string) {
  const stringListRegex = /^([^,]+)(,\s*[^,]+)*$/;
  return stringListRegex.test(s);
}

const StringListEdit: FunctionComponent<StringListEditProps> = ({
  value,
  setValue,
  setValid,
}) => {
  const [internalValue, setInternalValue] = useState<string | undefined>(
    undefined,
  );
  useEffect(() => {
    if (isStringListType(value)) {
      setInternalValue((old) => {
        if (
          old !== undefined &&
          stringIsValidStringList(old) &&
          stringListToString(value) === old
        )
          return old;
        return stringListToString(value);
      });
    }
  }, [value]);

  useEffect(() => {
    if (internalValue === undefined) return;
    if (stringIsValidStringList(internalValue)) {
      setValue(stringToStringList(internalValue));
      setValid(true);
    } else {
      setValid(false);
    }
  }, [internalValue, setValue, setValid]);

  const isValid = useMemo(() => {
    if (internalValue === undefined) return false;
    return stringIsValidStringList(internalValue);
  }, [internalValue]);

  return (
    <span>
      <input
        type="text"
        value={internalValue || ""}
        onChange={(evt) => {
          setInternalValue(evt.target.value);
        }}
      />
      {isValid ? null : <span style={{ color: "red" }}>x</span>}
    </span>
  );
};

type DisplayParameterValueProps = {
  parameter: PairioAppProcessorParameter;
  value: any;
};

const DisplayParameterValue: FunctionComponent<DisplayParameterValueProps> = ({
  parameter,
  value,
}) => {
  const { type } = parameter;
  if (type === "str") {
    return <span>{value}</span>;
  } else if (type === "int") {
    return <span>{value}</span>;
  } else if (type === "float") {
    return <span>{value}</span>;
  } else if (type === "bool") {
    return <span>{value ? "true" : "false"}</span>;
  } else if (type === "List[float]") {
    return <span>{value !== undefined ? value.join(", ") : "undefined"}</span>;
  } else {
    return <div>Unsupported type: {type}</div>;
  }
};

const indentForName = (name: string) => {
  const aa = name.split(".");
  return (
    <span>
      {aa.map((_, index) => (
        <span key={index}>&nbsp;&nbsp;&nbsp;</span>
      ))}
    </span>
  );
};

const baseName = (name: string) => {
  const aa = name.split(".");
  return aa[aa.length - 1];
};

export default EditJobDefinitionWindow;
