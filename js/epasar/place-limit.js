(function () {
  'use strict';
  const clean = value => String(value || '').trim();
  function placeKey(place) {
    const unit = [clean(place?.unitType).toUpperCase(), clean(place?.unitNumber).toUpperCase(), clean(place?.block).toUpperCase(), clean(place?.floor).toUpperCase()].join('|');
    return clean(place?.existingPlaceKey || place?.marketUnitId || place?.claimId || unit);
  }
  function groupProposals(rows) {
    const groups = new Map();
    for (const row of rows || []) {
      const marketId = clean(row?.marketId || row?.place?.marketId);
      if (!marketId) throw new Error('ID pasar wajib tersedia untuk validasi batas tempat.');
      const key = placeKey(row?.place || row);
      if (!key) throw new Error('Identitas tempat wajib tersedia untuk validasi batas tempat.');
      if (!groups.has(marketId)) groups.set(marketId, new Set());
      groups.get(marketId).add(key);
    }
    return groups;
  }
  function assertProposalLimit(rows, maximum = 2) {
    const groups = groupProposals(rows);
    for (const [marketId, keys] of groups) if (keys.size > maximum) throw new Error(`Maksimal ${maximum} tempat untuk satu pedagang pada pasar yang sama (${marketId}).`);
    return Object.fromEntries([...groups].map(([marketId, keys]) => [marketId, [...keys]]));
  }
  function mergeLedger(existingKeys, proposedKeys, maximum = 2) {
    const merged = [...new Set([...(existingKeys || []).map(clean).filter(Boolean), ...(proposedKeys || []).map(clean).filter(Boolean)])];
    if (merged.length > maximum) throw new Error(`Penambahan ditolak karena akan melebihi batas ${maximum} tempat pada pasar yang sama.`);
    return merged;
  }
  window.EPASAR_PLACE_LIMIT = { placeKey, groupProposals, assertProposalLimit, mergeLedger };
}());
