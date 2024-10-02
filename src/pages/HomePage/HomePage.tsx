/* eslint-disable @typescript-eslint/no-explicit-any */
import { Hyperlink } from "@fi-sci/misc";
import { FunctionComponent, useEffect, useState } from "react";
import LoginButton from "../../LoginButton";
import useRoute from "../../useRoute";
// import { getGitHubAccessToken } from "./App";

type Props = {
  // none
};

const HomePage: FunctionComponent<Props> = () => {
  const { setRoute } = useRoute();
  const { recentServices } = useRecentServices();
  const a = localStorage.getItem("in-process-of-registering-compute-client");
  return (
    <div style={{ padding: 30 }}>
      <h3>Dendro: Dendro Prototype 3</h3>
      {a && (
        <Hyperlink
          onClick={() => {
            setRoute(JSON.parse(a));
          }}
        >
          CONTINUE REGISTERING COMPUTE CLIENT
        </Hyperlink>
      )}
      <p>
        <a
          href="https://github.com/magland/dendro"
          target="_blank"
          rel="noopener noreferrer"
        >
          Read more...
        </a>
      </p>
      <div>
        <LoginButton />
      </div>
      <hr />
      <div>
        <div>
          <Hyperlink
            onClick={() => {
              setRoute({ page: "services" });
            }}
          >
            Services
          </Hyperlink>
        </div>
      </div>
      {recentServices.length > 0 && (
        <div>
          Recent:{" "}
          {recentServices.map((serviceName) => (
            <span key={serviceName}>
              <Hyperlink
                onClick={() => {
                  setRoute({ page: "service", serviceName });
                }}
              >
                {serviceName}
              </Hyperlink>
              &nbsp;
            </span>
          ))}
        </div>
      )}
      <hr />
      <div>
        <Hyperlink
          onClick={() => {
            setRoute({ page: "settings" });
          }}
        >
          Settings
        </Hyperlink>
      </div>
      <hr />
      <Hyperlink
        onClick={() => {
          setRoute({ page: "playground" });
        }}
      >
        Playground
      </Hyperlink>
    </div>
  );
};

const useRecentServices = () => {
  const [recentServices, setRecentServices] = useState<string[]>([]);
  useEffect(() => {
    const update = () => {
      try {
        const x = localStorage.getItem("recent_services");
        if (x) {
          const y = JSON.parse(x);
          assertListOfStrings(y);
          setRecentServices(y);
        }
      } catch (err) {
        console.warn(err);
      }
    };
    const timeout = setTimeout(update, 1000);
    return () => {
      clearTimeout(timeout);
    };
  }, []);

  return { recentServices };
};

export const reportRecentService = (serviceName: string) => {
  let recentServices: string[] = [];
  try {
    const x = localStorage.getItem("recent_services");
    if (x) {
      recentServices = JSON.parse(x);
      assertListOfStrings(recentServices);
    }
  } catch (err) {
    console.warn(err);
  }
  recentServices = recentServices.filter((name) => name !== serviceName);
  recentServices.unshift(serviceName);
  recentServices = recentServices.slice(0, 10);
  localStorage.setItem("recent_services", JSON.stringify(recentServices));
};

const assertListOfStrings = (x: any) => {
  if (!Array.isArray(x)) {
    throw new Error("Expected array");
  }
  for (const i in x) {
    if (typeof x[i] !== "string") {
      throw new Error("Expected string");
    }
  }
};

export default HomePage;
