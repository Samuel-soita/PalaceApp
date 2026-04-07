import { z } from 'zod';
import { CreateEventSchema } from './src/schemas/EventSchema.js';
import { CreateProjectSchema } from './src/schemas/ProjectSchema.js';
import { CreatePlanSchema } from './src/schemas/PlanSchema.js';

const eventPayload = {
    title: "My Event",
    eventType: "CONFERENCE",
    time: "12:00",
    date: "2026-04-10T12:00:00.000Z",
    location: "Main Hall",
    description: "Big Event",
    budgetNeeded: 500,
    status: "PLANNED",
    isMajor: true,
    volunteersNeeded: 10,
    departmentId: "",
    pastorIds: ["804868e4-b778-4e8c-8dc7-28d5d11822c9", "b07f87ba-589f-4318-ae71-d85cff02b5db"]
};

try { CreateEventSchema.parse({ body: eventPayload }); console.log("Event OK"); } catch(e: any) { console.error("Event failed:", JSON.stringify(e.errors, null, 2)); }

const projectPayload = {
    title: "My Project",
    description: "Big Project",
    status: "PLANNED",
    budget: 0,
    isMajor: true,
    departmentId: "",
    pastorIds: ["804868e4-b778-4e8c-8dc7-28d5d11822c9", "b07f87ba-589f-4318-ae71-d85cff02b5db"],
    category: "GENERAL",
    deadline: "2026-04-10T12:00:00.000Z"
};
try { CreateProjectSchema.parse({ body: projectPayload }); console.log("Project OK"); } catch(e: any) { console.error("Project failed:", JSON.stringify(e.errors, null, 2)); }

const planPayload = {
    title: "My Plan",
    type: "MONTHLY",
    description: "Big Plan",
    isMajor: true,
    departmentId: "",
    pastorIds: ["804868e4-b778-4e8c-8dc7-28d5d11822c9", "b07f87ba-589f-4318-ae71-d85cff02b5db"]
};
try { CreatePlanSchema.parse({ body: planPayload }); console.log("Plan OK"); } catch(e: any) { console.error("Plan failed:", JSON.stringify(e.errors, null, 2)); }
