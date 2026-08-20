// Resubmit the rejected version for App Review.
//
//   node scripts/asc-resubmit.mjs           # show submissions + version/build state
//   node scripts/asc-resubmit.mjs --go      # create submission, add version, submit
import { asc, APP_ID } from "./lib/asc.mjs";

const subs = await asc("GET", `/reviewSubmissions?filter[app]=${APP_ID}&limit=5`);
for (const s of subs.data || []) {
  console.log(`submission ${s.id} — ${s.attributes.state} (platform ${s.attributes.platform})`);
}

const versions = await asc("GET", `/apps/${APP_ID}/appStoreVersions?limit=1`);
const v = versions.data?.[0];
console.log(`version ${v.attributes.versionString} — ${v.attributes.appVersionState} (id ${v.id})`);
const build = await asc("GET", `/appStoreVersions/${v.id}/build`).catch(() => null);
console.log("attached build:", build?.data?.attributes?.version ?? "(none)");

if (!process.argv.includes("--go")) process.exit(0);

// An UNRESOLVED_ISSUES submission blocks a new one — cancel it first.
for (const s of subs.data || []) {
  if (s.attributes.state === "UNRESOLVED_ISSUES") {
    await asc("PATCH", `/reviewSubmissions/${s.id}`, {
      data: { type: "reviewSubmissions", id: s.id, attributes: { canceled: true } },
    }).then(() => console.log(`canceled ${s.id}`))
      .catch((e) => console.log(`cancel ${s.id} failed: ${String(e).slice(0, 160)}`));
  }
}

// Reuse an open draft submission if one exists (a prior run may have made it).
let subId = (subs.data || []).find((s) => s.attributes.state === "READY_FOR_REVIEW")?.id;
if (!subId) {
  const created = await asc("POST", "/reviewSubmissions", {
    data: {
      type: "reviewSubmissions",
      attributes: { platform: "IOS" },
      relationships: { app: { data: { type: "apps", id: APP_ID } } },
    },
  });
  subId = created.data.id;
  console.log("created submission", subId);
} else {
  console.log("reusing draft submission", subId);
}

await asc("POST", "/reviewSubmissionItems", {
  data: {
    type: "reviewSubmissionItems",
    relationships: {
      reviewSubmission: { data: { type: "reviewSubmissions", id: subId } },
      appStoreVersion: { data: { type: "appStoreVersions", id: v.id } },
    },
  },
});
console.log("version added to submission");

await asc("PATCH", `/reviewSubmissions/${subId}`, {
  data: { type: "reviewSubmissions", id: subId, attributes: { submitted: true } },
});
console.log("SUBMITTED for review");
