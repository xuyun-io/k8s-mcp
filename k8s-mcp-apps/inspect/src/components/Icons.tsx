import React from "react";
import {
  Cpu,
  MemoryStick,
  HardDrive,
  Boxes,
  Database,
  Globe,
  Clock,
  FileKey,
  FileText,
  AlertTriangle,
} from "lucide-react";

const iconProps = { size: 20, strokeWidth: 1.5 };

export const IconCpu: React.FC<{ className?: string }> = () => <Cpu {...iconProps} />;
export const IconMemory: React.FC<{ className?: string }> = () => <MemoryStick {...iconProps} />;
export const IconStorage: React.FC<{ className?: string }> = () => <HardDrive {...iconProps} />;
export const IconPods: React.FC<{ className?: string }> = () => <Boxes {...iconProps} />;
export const IconPvc: React.FC<{ className?: string }> = () => <Database {...iconProps} />;
export const IconIngress: React.FC<{ className?: string }> = () => <Globe {...iconProps} />;
export const IconCronjob: React.FC<{ className?: string }> = () => <Clock {...iconProps} />;
export const IconConfigMap: React.FC<{ className?: string }> = () => <FileText {...iconProps} />;
export const IconSecret: React.FC<{ className?: string }> = () => <FileKey {...iconProps} />;
export const IconOrphan: React.FC<{ className?: string }> = () => <AlertTriangle {...iconProps} />;
