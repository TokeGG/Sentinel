import { useState, type ComponentType } from "react";
import { Tabs } from "../../../ui/kit";
import { DiskTool } from "./DiskTool";
import { DupesTool } from "./DupesTool";
import { FilesTool } from "./FilesTool";
import { NetTool } from "./NetTool";
import { ProcTool } from "./ProcTool";
import { SecurityTool } from "./SecurityTool";
import { StartupTool } from "./StartupTool";
import { SystemTool } from "./SystemTool";
import { PC_TOOL_TABS } from "../panelLogic";

const VIEWS: Record<string, ComponentType> = {
  startup: StartupTool, disk: DiskTool, dupes: DupesTool, procs: ProcTool, system: SystemTool, files: FilesTool, net: NetTool, security: SecurityTool,
};

// Every tool does nothing until its own button is pressed; destructive steps show a preview and confirm.
export function ToolsSection() {
  const [tab, setTab] = useState("startup");
  const View = VIEWS[tab] ?? StartupTool;
  return (
    <div className="pc-tools">
      <Tabs tabs={PC_TOOL_TABS} active={tab} onChange={setTab} />
      <View />
    </div>
  );
}
