"use client";

import Link from "next/link";
import {
  FolderIcon,
  CubeIcon,
  ClipboardDocumentListIcon,
} from "@heroicons/react/24/outline";

interface ProjectReferenceProps {
  type: string;  // "project" | "node" | "card"
  id: string;
  name: string;
}

export default function ProjectReference({ type, id, name }: ProjectReferenceProps) {
  const getIcon = () => {
    switch (type) {
      case "project":
        return <FolderIcon className="w-3.5 h-3.5" />;
      case "node":
        return <CubeIcon className="w-3.5 h-3.5" />;
      case "card":
        return <ClipboardDocumentListIcon className="w-3.5 h-3.5" />;
      default:
        return <FolderIcon className="w-3.5 h-3.5" />;
    }
  };

  const getLabel = () => {
    switch (type) {
      case "project": return "Project";
      case "node": return "Feature";
      case "card": return "Task";
      default: return "Reference";
    }
  };

  const getHref = () => {
    switch (type) {
      case "project":
        return `/projects/${id}/discovery`;
      case "node":
        return "#"; // nodes don't have standalone pages
      case "card":
        return "#"; // cards don't have standalone pages
      default:
        return "#";
    }
  };

  const href = getHref();
  const isLink = href !== "#";

  const content = (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-neutral-100 border border-neutral-200 rounded-md text-xs text-neutral-700 hover:bg-neutral-200 transition-colors mt-1">
      {getIcon()}
      <span className="text-neutral-400">{getLabel()}:</span>
      <span className="font-medium truncate max-w-[200px]">{name}</span>
    </span>
  );

  if (isLink) {
    return <Link href={href}>{content}</Link>;
  }

  return <span title={`${getLabel()}: ${name}`}>{content}</span>;
}
