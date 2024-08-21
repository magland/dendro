/* eslint-disable @typescript-eslint/no-explicit-any */
import { PairioJobDefinition } from "../../../types";

export type PairioJobDefinitionAction =
  | {
      type: "setInputFile";
      name: string;
      url: string;
    }
  | {
      type: "setParameter";
      name: string;
      value: any;
    }
  | {
      type: "setProcessorName";
      processorName: string;
    }
  | {
      type: "setAppName";
      appName: string;
    }
  | {
      type: "setJobDefinition";
      jobDefinition: PairioJobDefinition;
    };

export const pairioJobDefinitionReducer = (
  state: PairioJobDefinition,
  action: PairioJobDefinitionAction,
): PairioJobDefinition => {
  switch (action.type) {
    case "setInputFile":
      // check if no change
      if (
        state.inputFiles.find(
          (f) => f.name === action.name && f.url === action.url,
        )
      ) {
        return state;
      }
      if (state.inputFiles.find((f) => f.name === action.name)) {
        return {
          ...state,
          inputFiles: state.inputFiles.map((f) =>
            f.name === action.name ? { ...f, url: action.url } : f,
          ),
        };
      } else {
        return {
          ...state,
          inputFiles: [
            ...state.inputFiles,
            { name: action.name, fileBaseName: "", url: action.url },
          ],
        };
      }
    case "setParameter":
      // check if no change
      if (
        state.parameters.find(
          (p) => p.name === action.name && deepEqual(p.value, action.value),
        )
      ) {
        return state;
      }
      if (state.parameters.find((p) => p.name === action.name)) {
        return {
          ...state,
          parameters: state.parameters.map((p) =>
            p.name === action.name ? { ...p, value: action.value } : p,
          ),
        };
      } else {
        return {
          ...state,
          parameters: [
            ...state.parameters,
            { name: action.name, value: action.value },
          ],
        };
      }
    case "setProcessorName":
      // check if no change
      if (state.processorName === action.processorName) {
        return state;
      }
      return {
        ...state,
        processorName: action.processorName,
      };
    case "setAppName":
      // check if no change
      if (state.appName === action.appName) {
        return state;
      }
      return {
        ...state,
        appName: action.appName,
      };
    case "setJobDefinition":
      return action.jobDefinition;
    default:
      throw Error(`Unexpected action type ${(action as any).type}`);
  }
};

const deepEqual = (a: any, b: any): boolean => {
  if (typeof a !== typeof b) {
    return false;
  }
  if (a === null) {
    return b === null;
  }
  if (typeof a === "object") {
    if (Array.isArray(a)) {
      if (!Array.isArray(b)) {
        return false;
      }
      if (a.length !== b.length) {
        return false;
      }
      for (let i = 0; i < a.length; i++) {
        if (!deepEqual(a[i], b[i])) {
          return false;
        }
      }
      return true;
    } else {
      const aKeys = Object.keys(a);
      const bKeys = Object.keys(b);
      if (aKeys.length !== bKeys.length) {
        return false;
      }
      for (const key of aKeys) {
        if (!deepEqual(a[key], b[key])) {
          return false;
        }
      }
      return true;
    }
  } else {
    return a === b;
  }
};
