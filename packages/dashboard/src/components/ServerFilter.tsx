import { useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './ServerFilter.module.css';

interface ServerFilterProps {
  onFilterChange: (filter: ServerFilterState) => void;
}

export interface ServerFilterState {
  search: string;
  status: 'all' | 'normal' | 'warning' | 'critical';
  rack: number | null;
  sortBy: 'id' | 'temp' | 'power' | 'anomaly';
}

export default function ServerFilter({ onFilterChange }: ServerFilterProps) {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<ServerFilterState['status']>('all');
  const [rack, setRack] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<ServerFilterState['sortBy']>('id');

  const update = useCallback((partial: Partial<ServerFilterState>) => {
    const next: ServerFilterState = {
      search: partial.search ?? search,
      status: partial.status ?? status,
      rack: partial.rack !== undefined ? partial.rack : rack,
      sortBy: partial.sortBy ?? sortBy,
    };
    if (partial.search !== undefined) setSearch(partial.search);
    if (partial.status !== undefined) setStatus(partial.status);
    if (partial.rack !== undefined) setRack(partial.rack);
    if (partial.sortBy !== undefined) setSortBy(partial.sortBy);
    onFilterChange(next);
  }, [search, status, rack, sortBy, onFilterChange]);

  return (
    <div className={styles.container}>
      <div className={styles.searchBox}>
        <span className={styles.searchIcon}>🔍</span>
        <input
          type="text"
          className={styles.searchInput}
          placeholder={t('filter.searchPlaceholder')}
          value={search}
          onChange={e => update({ search: e.target.value })}
        />
        {search && (
          <button className={styles.clearBtn} onClick={() => update({ search: '' })}>✕</button>
        )}
      </div>

      <div className={styles.filters}>
        <select
          className={styles.select}
          value={status}
          onChange={e => update({ status: e.target.value as ServerFilterState['status'] })}
        >
          <option value="all">{t('filter.allStatus')}</option>
          <option value="normal">{t('filter.normal')}</option>
          <option value="warning">{t('filter.warning')}</option>
          <option value="critical">{t('filter.critical')}</option>
        </select>

        <select
          className={styles.select}
          value={rack ?? ''}
          onChange={e => update({ rack: e.target.value ? parseInt(e.target.value) : null })}
        >
          <option value="">{t('filter.allRacks')}</option>
          {Array.from({ length: 10 }, (_, i) => (
            <option key={i} value={i}>{t('filter.rack')} {i}</option>
          ))}
        </select>

        <select
          className={styles.select}
          value={sortBy}
          onChange={e => update({ sortBy: e.target.value as ServerFilterState['sortBy'] })}
        >
          <option value="id">{t('filter.sortId')}</option>
          <option value="temp">{t('filter.sortTemp')}</option>
          <option value="power">{t('filter.sortPower')}</option>
          <option value="anomaly">{t('filter.sortAnomaly')}</option>
        </select>
      </div>
    </div>
  );
}

/** Apply filter to summaries data. Returns filtered server indices. */
export function applyFilter(
  filter: ServerFilterState,
  summaries: Float32Array | null,
  rawBatch: any[] | null,
): number[] {
  const total = summaries ? Math.floor(summaries.length / 3) : 100;
  let indices = Array.from({ length: total }, (_, i) => i);

  // Search by name/id
  if (filter.search) {
    const q = filter.search.toLowerCase();
    indices = indices.filter(i => {
      const name = `GB200-NVL72-${String(i).padStart(3, '0')}`.toLowerCase();
      const sid = `s${String(i).padStart(3, '0')}`;
      return name.includes(q) || sid.includes(q) || String(i).includes(q);
    });
  }

  // Rack filter
  if (filter.rack !== null) {
    indices = indices.filter(i => Math.floor(i / 10) === filter.rack);
  }

  // Status filter
  if (filter.status !== 'all' && summaries) {
    indices = indices.filter(i => {
      const maxTemp = summaries[i * 3 + 1];
      const status = maxTemp >= 85 ? 'critical' : maxTemp >= 75 ? 'warning' : 'normal';
      return status === filter.status;
    });
  }

  // Sort
  if (summaries) {
    switch (filter.sortBy) {
      case 'temp':
        indices.sort((a, b) => (summaries[b * 3 + 1]) - (summaries[a * 3 + 1]));
        break;
      case 'anomaly':
        indices.sort((a, b) => (summaries[b * 3 + 2]) - (summaries[a * 3 + 2]));
        break;
      case 'power':
        if (rawBatch) {
          indices.sort((a, b) => {
            const pa = rawBatch.find(s => s.serverId === a)?.power.chassisWattage ?? 0;
            const pb = rawBatch.find(s => s.serverId === b)?.power.chassisWattage ?? 0;
            return pb - pa;
          });
        }
        break;
      default:
        indices.sort((a, b) => a - b);
    }
  }

  return indices;
}
