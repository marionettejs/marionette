const coreVersion = '(?:0|[1-9][0-9]*)';
const prereleaseIdentifier = '(?:0|[1-9][0-9]*|[0-9]*[A-Za-z-][0-9A-Za-z-]*)';
const basePattern = `${coreVersion}\\.${coreVersion}\\.${coreVersion}`;
const prereleasePattern = `${prereleaseIdentifier}(?:\\.${prereleaseIdentifier})*`;
const prereleaseVersion = new RegExp(`^${basePattern}-${prereleasePattern}$`);
const releaseVersion = new RegExp(`^${basePattern}(?:-${prereleasePattern})?$`);

// Publication permission is scoped to the release version, independently of its dist-tag.
export function publicationEnabled(policy, version) {
  const { publication } = policy;
  if (policy.schemaVersion !== 2 || typeof publication?.stable !== 'boolean' ||
      !(publication.prerelease === null ||
        (typeof publication.prerelease === 'string' && prereleaseVersion.test(publication.prerelease)))) {
    throw new Error('Invalid release publication policy: expected schema 2, a stable boolean and an exact prerelease version or null.');
  }
  if (typeof version !== 'string' || !releaseVersion.test(version)) {
    throw new Error(`Invalid release version: ${version}`);
  }
  return version.includes('-') ? publication.prerelease === version : publication.stable;
}
