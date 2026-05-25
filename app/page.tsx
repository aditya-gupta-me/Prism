"use client";

import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";

export default function Home() {
  const projects = useQuery(api.projects.get);
  const createProject = useMutation(api.projects.create);

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        onClick={() =>
          createProject({
            name: "New Project",
          })
        }
      >
        Add new
      </Button>
      {projects?.map((project) => (
        <div key={project._id} className="border rounded p-2 flex flex-col">
          <p>{project.name}</p>
          <p>Owner ID: {project.ownerId}</p>
        </div>
      ))}
    </div>
  );
}
