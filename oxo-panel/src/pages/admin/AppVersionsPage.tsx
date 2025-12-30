import { useState, useEffect } from 'react';
import { Trash2, Plus, Download, AlertTriangle, Check, X, Github, ExternalLink, Link } from 'lucide-react';
import { adminApi } from '../../services/api';

// GitHub config
const GITHUB_OWNER = 'vimastec';
const GITHUB_REPO = 'oxo-player-releases';
const GITHUB_RELEASES_URL = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/new`;

interface AppVersion {
  id: number;
  versionCode: number;
  versionName: string;
  downloadUrl: string;
  changelog: string;
  isMandatory: boolean;
  minSupportedVersion: number | null;
  createdAt: string;
}

export function AppVersionsPage() {
  const [versions, setVersions] = useState<AppVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Form state
  const [versionCode, setVersionCode] = useState('');
  const [versionName, setVersionName] = useState('');
  const [downloadUrl, setDownloadUrl] = useState('');
  const [changelog, setChangelog] = useState('');
  const [isMandatory, setIsMandatory] = useState(false);
  const [minSupportedVersion, setMinSupportedVersion] = useState('');

  useEffect(() => {
    loadVersions();
  }, []);

  const loadVersions = async () => {
    try {
      const response = await adminApi.getAppVersions();
      setVersions(response.data.versions || []);
    } catch (err) {
      console.error('Error loading versions:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!versionCode || !versionName || !downloadUrl) {
      setError('Le code version, nom de version et URL de téléchargement sont requis');
      return;
    }

    // Validate URL
    if (!downloadUrl.startsWith('https://')) {
      setError('L\'URL doit commencer par https://');
      return;
    }

    setSaving(true);

    try {
      await adminApi.createAppVersion({
        versionCode: parseInt(versionCode, 10),
        versionName,
        downloadUrl,
        changelog: changelog || '',
        isMandatory,
        minSupportedVersion: minSupportedVersion ? parseInt(minSupportedVersion, 10) : undefined,
      });

      setShowModal(false);
      resetForm();
      await loadVersions();
    } catch (err: any) {
      console.error('Error creating version:', err);
      setError(err.response?.data?.error || 'Erreur lors de la création de la version');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette version ?')) return;

    try {
      await adminApi.deleteAppVersion(id);
      await loadVersions();
    } catch (err) {
      console.error('Error deleting version:', err);
    }
  };

  const resetForm = () => {
    setVersionCode('');
    setVersionName('');
    setDownloadUrl('');
    setChangelog('');
    setIsMandatory(false);
    setMinSupportedVersion('');
    setError('');
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Versions de l'application</h1>
          <p className="text-muted mt-1">Gérez les mises à jour OTA de l'application Android TV</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary rounded-xl hover:bg-primary/80 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Nouvelle version
        </button>
      </div>

      {/* Instructions */}
      <div className="mb-6 p-4 bg-dark/50 rounded-xl border border-border space-y-3">
        <div className="flex items-center gap-2 text-white font-medium">
          <Github className="w-5 h-5" />
          Comment publier une nouvelle version ?
        </div>
        <ol className="text-sm text-muted space-y-2 list-decimal list-inside">
          <li>
            <a 
              href={GITHUB_RELEASES_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline inline-flex items-center gap-1"
            >
              Créer une release sur GitHub <ExternalLink className="w-3 h-3" />
            </a>
            {' '}et uploader l'APK
          </li>
          <li>Copier l'URL de téléchargement de l'APK (clic droit → Copier l'adresse du lien)</li>
          <li>Cliquer sur "Nouvelle version" et coller l'URL</li>
        </ol>
      </div>

      {/* Versions list */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-dark/50">
              <th className="text-left p-4 font-medium">Version</th>
              <th className="text-left p-4 font-medium">Code</th>
              <th className="text-left p-4 font-medium">Obligatoire</th>
              <th className="text-left p-4 font-medium">Date</th>
              <th className="text-left p-4 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {versions.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-muted">
                  Aucune version publiée
                </td>
              </tr>
            ) : (
              versions.map((version) => (
                <tr key={version.id} className="border-b border-border hover:bg-dark/30">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                        <Download className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">v{version.versionName}</p>
                        {version.changelog && (
                          <p className="text-sm text-muted truncate max-w-xs">{version.changelog}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <span className="px-2 py-1 bg-dark rounded text-sm">{version.versionCode}</span>
                  </td>
                  <td className="p-4">
                    {version.isMandatory ? (
                      <span className="flex items-center gap-1 text-warning">
                        <AlertTriangle className="w-4 h-4" />
                        Oui
                      </span>
                    ) : (
                      <span className="text-muted">Non</span>
                    )}
                  </td>
                  <td className="p-4 text-muted">{formatDate(version.createdAt)}</td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <a
                        href={version.downloadUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 hover:bg-dark rounded-lg transition-colors"
                        title="Télécharger"
                      >
                        <Download className="w-4 h-4" />
                      </a>
                      <button
                        onClick={() => handleDelete(version.id)}
                        className="p-2 hover:bg-error/10 text-error rounded-lg transition-colors"
                        title="Supprimer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-2xl border border-border w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <h2 className="text-xl font-bold">Nouvelle version</h2>
              <button
                onClick={() => {
                  setShowModal(false);
                  resetForm();
                }}
                className="p-2 hover:bg-dark rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {error && (
                <div className="p-3 bg-error/10 border border-error/30 rounded-lg text-error text-sm">
                  {error}
                </div>
              )}

              {/* Download URL */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  <Link className="w-4 h-4 inline mr-1" />
                  URL de téléchargement de l'APK *
                </label>
                <input
                  type="url"
                  value={downloadUrl}
                  onChange={(e) => setDownloadUrl(e.target.value)}
                  placeholder="https://github.com/.../releases/download/.../app-release.apk"
                  className="w-full px-4 py-2 bg-dark border border-border rounded-xl focus:outline-none focus:border-primary text-sm"
                  required
                />
                <p className="text-xs text-muted mt-1">
                  Copiez l'URL depuis votre release GitHub
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Nom de version *</label>
                  <input
                    type="text"
                    value={versionName}
                    onChange={(e) => setVersionName(e.target.value)}
                    placeholder="1.6.0"
                    className="w-full px-4 py-2 bg-dark border border-border rounded-xl focus:outline-none focus:border-primary"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Code version *</label>
                  <input
                    type="number"
                    value={versionCode}
                    onChange={(e) => setVersionCode(e.target.value)}
                    placeholder="20"
                    className="w-full px-4 py-2 bg-dark border border-border rounded-xl focus:outline-none focus:border-primary"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Notes de version</label>
                <textarea
                  value={changelog}
                  onChange={(e) => setChangelog(e.target.value)}
                  placeholder="Nouveautés de cette version..."
                  rows={3}
                  className="w-full px-4 py-2 bg-dark border border-border rounded-xl focus:outline-none focus:border-primary resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Version minimum supportée</label>
                <input
                  type="number"
                  value={minSupportedVersion}
                  onChange={(e) => setMinSupportedVersion(e.target.value)}
                  placeholder="15 (optionnel)"
                  className="w-full px-4 py-2 bg-dark border border-border rounded-xl focus:outline-none focus:border-primary"
                />
                <p className="text-xs text-muted mt-1">
                  Les versions inférieures seront forcées de mettre à jour
                </p>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="mandatory"
                  checked={isMandatory}
                  onChange={(e) => setIsMandatory(e.target.checked)}
                  className="w-4 h-4 rounded border-border bg-dark"
                />
                <label htmlFor="mandatory" className="text-sm">
                  Mise à jour obligatoire
                </label>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
                  }}
                  className="flex-1 px-4 py-2 bg-dark border border-border rounded-xl hover:bg-card transition-colors"
                  disabled={saving}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-primary rounded-xl hover:bg-primary/80 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  disabled={saving}
                >
                  <Check className="w-4 h-4" />
                  {saving ? 'Enregistrement...' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
