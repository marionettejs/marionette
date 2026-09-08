// Publication permission is scoped to the release version, independently of its dist-tag.
export function publicationEnabled(policy, version) {
  const { publication } = policy;
  if (policy.schemaVersion !== 2 || typeof publication?.stable !== 'boolean' ||
      !(publication.prerelease === null ||
        (typeof publication.prerelease === 'string' && /^\d+\.\d+\.\d+-[0-9A-Za-z.-]+$/.test(publication.prerelease)))) {
    throw new Error('Invalid release publication policy: expected schema 2, a stable boolean and an exact prerelease version or null.');
  }
  if (typeof version !== 'string' || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
    throw new Error(`Invalid release version: ${version}`);
  }
  return version.includes('-') ? publication.prerelease === version : publication.stable;
}
