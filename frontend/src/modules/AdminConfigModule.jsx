import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Label } from "../components/ui/Label";
import { Textarea } from "../components/ui/Textarea";
import { useApiConnection } from "./useApiConnection";

const toListString = (values) => (values && values.length ? values.join(", ") : "");

const AdminConfigModule = () => {
  const { apiUrl, headers, isReady, refresh } = useApiConnection();
  const [roles, setRoles] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [roleForm, setRoleForm] = useState({
    name: "",
    description: "",
    permissions: "",
  });
  const [activeRole, setActiveRole] = useState(null);
  const [roleEditor, setRoleEditor] = useState({
    description: "",
    permissions: "",
  });
  const [roleSaving, setRoleSaving] = useState(false);
  const [userSaving, setUserSaving] = useState({});

  const fetchData = useCallback(async () => {
    if (!isReady) return;
    setLoading(true);
    setError("");
    try {
      const [rolesResponse, usersResponse] = await Promise.all([
        axios.get(`${apiUrl}/roles`, { headers }),
        axios.get(`${apiUrl}/users`, { headers }),
      ]);
      setRoles(rolesResponse.data || []);
      setUsers(usersResponse.data || []);
    } catch (err) {
      const message =
        err?.response?.data?.detail || err?.message || "Rol/uye verileri yuklenemedi.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [apiUrl, headers, isReady]);

  useEffect(() => {
    if (!isReady) {
      setRoles([]);
      setUsers([]);
      return;
    }
    fetchData();
  }, [fetchData, isReady]);

  const handleCreateRole = async () => {
    if (!roleForm.name.trim()) {
      setError("Rol adi zorunludur.");
      return;
    }
    setRoleSaving(true);
    setError("");
    try {
      await axios.post(
        `${apiUrl}/roles`,
        {
          name: roleForm.name.trim(),
          description: roleForm.description.trim(),
          permissions: roleForm.permissions
            .split(",")
            .map((perm) => perm.trim())
            .filter(Boolean),
        },
        { headers }
      );
      setRoleForm({ name: "", description: "", permissions: "" });
      await fetchData();
    } catch (err) {
      const message =
        err?.response?.data?.detail || err?.message || "Rol olusturulamadi.";
      setError(message);
    } finally {
      setRoleSaving(false);
    }
  };

  const handleSelectRole = (role) => {
    setActiveRole(role);
    setRoleEditor({
      description: role.description || "",
      permissions: toListString(role.permissions),
    });
  };

  const handleSaveRole = async () => {
    if (!activeRole) return;
    setRoleSaving(true);
    setError("");
    try {
      await axios.patch(
        `${apiUrl}/roles/${activeRole.name}`,
        {
          description: roleEditor.description,
          permissions: roleEditor.permissions
            .split(",")
            .map((perm) => perm.trim())
            .filter(Boolean),
        },
        { headers }
      );
      setActiveRole(null);
      await fetchData();
    } catch (err) {
      const message =
        err?.response?.data?.detail || err?.message || "Rol guncellenemedi.";
      setError(message);
    } finally {
      setRoleSaving(false);
    }
  };

  const handleDeleteRole = async (roleName) => {
    if (!roleName) return;
    setRoleSaving(true);
    setError("");
    try {
      await axios.delete(`${apiUrl}/roles/${roleName}`, { headers });
      if (activeRole?.name === roleName) {
        setActiveRole(null);
      }
      await fetchData();
    } catch (err) {
      const message =
        err?.response?.data?.detail || err?.message || "Rol silinemedi.";
      setError(message);
    } finally {
      setRoleSaving(false);
    }
  };

  const handleUpdateUser = async (userId, payload) => {
    setUserSaving((prev) => ({ ...prev, [userId]: true }));
    setError("");
    try {
      await axios.patch(`${apiUrl}/users/${userId}`, payload, { headers });
      await fetchData();
    } catch (err) {
      const message =
        err?.response?.data?.detail || err?.message || "Kullanici guncellenemedi.";
      setError(message);
    } finally {
      setUserSaving((prev) => ({ ...prev, [userId]: false }));
    }
  };

  const roleNames = useMemo(() => roles.map((role) => role.name), [roles]);

  return (
    <div className="module-wrapper">
      <header className="module-header">
        <div>
          <h1>Yetkilendirme ve Rol Yoneticisi</h1>
          <p>
            Roller icin izinleri tanimlayin, kullanicilara rol ve izin atamalarini
            yonetin.
          </p>
        </div>
        <Button variant="outline" onClick={fetchData} disabled={!isReady || loading}>
          Yenile
        </Button>
      </header>

      {!isReady && (
        <Card>
          <CardHeader>
            <CardTitle>Baglanti Bekleniyor</CardTitle>
          </CardHeader>
          <CardContent>
            <p>API baglantisini dogrulamak icin DOF modulu uzerinden ayarlari yapin.</p>
            <div className="actions-row" style={{ marginTop: "12px" }}>
              <Button onClick={refresh}>Baglantiyi Kontrol Et</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {error && (
        <Card>
          <CardHeader>
            <CardTitle>Hata</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{error}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Yeni Rol Olustur</CardTitle>
          <CardDescription>Rol adini ve izinlerini tanimlayin.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid two-cols">
            <div className="form-field">
              <Label htmlFor="role-name">Rol Adi</Label>
              <Input
                id="role-name"
                value={roleForm.name}
                onChange={(event) =>
                  setRoleForm((prev) => ({ ...prev, name: event.target.value }))
                }
                placeholder="or. doc.manager"
              />
            </div>
            <div className="form-field">
              <Label htmlFor="role-description">Aciklama</Label>
              <Input
                id="role-description"
                value={roleForm.description}
                onChange={(event) =>
                  setRoleForm((prev) => ({
                    ...prev,
                    description: event.target.value,
                  }))
                }
                placeholder="Rolun amaci"
              />
            </div>
            <div className="form-field" style={{ gridColumn: "1 / -1" }}>
              <Label htmlFor="role-permissions">Izinler (virgul ile)</Label>
              <Textarea
                id="role-permissions"
                rows={3}
                value={roleForm.permissions}
                onChange={(event) =>
                  setRoleForm((prev) => ({
                    ...prev,
                    permissions: event.target.value,
                  }))
                }
                placeholder="or. doc.read, doc.manage"
              />
            </div>
          </div>
          <div className="actions-row" style={{ marginTop: "12px" }}>
            <Button onClick={handleCreateRole} disabled={roleSaving || !isReady}>
              {roleSaving ? "Kaydediliyor..." : "Rol Olustur"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Roller</CardTitle>
          <CardDescription>Var olan rollerin izinlerini duzenleyin.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading && roles.length === 0 ? (
            <div className="loading-state">Roller yukleniyor...</div>
          ) : roles.length === 0 ? (
            <p>Tanimli rol bulunmuyor.</p>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Rol</th>
                    <th>Aciklama</th>
                    <th>Izinler</th>
                    <th>Islem</th>
                  </tr>
                </thead>
                <tbody>
                  {roles.map((role) => {
                    const isEditing = activeRole?.name === role.name;
                    return (
                      <tr key={role.name}>
                        <td>{role.name}</td>
                        <td>
                          {isEditing ? (
                            <Input
                              value={roleEditor.description}
                              onChange={(event) =>
                                setRoleEditor((prev) => ({
                                  ...prev,
                                  description: event.target.value,
                                }))
                              }
                            />
                          ) : (
                            role.description || "-"
                          )}
                        </td>
                        <td>
                          {isEditing ? (
                            <Textarea
                              rows={3}
                              value={roleEditor.permissions}
                              onChange={(event) =>
                                setRoleEditor((prev) => ({
                                  ...prev,
                                  permissions: event.target.value,
                                }))
                              }
                            />
                          ) : (
                            (role.permissions || []).join(", ")
                          )}
                        </td>
                        <td>
                          <div className="actions-row">
                            {isEditing ? (
                              <>
                                <Button
                                  variant="outline"
                                  onClick={handleSaveRole}
                                  disabled={roleSaving}
                                >
                                  Kaydet
                                </Button>
                                <Button
                                  variant="ghost"
                                  onClick={() => setActiveRole(null)}
                                >
                                  Iptal
                                </Button>
                              </>
                            ) : (
                              <>
                                <Button
                                  variant="outline"
                                  onClick={() => handleSelectRole(role)}
                                >
                                  Duzenle
                                </Button>
                                <Button
                                  variant="ghost"
                                  onClick={() => handleDeleteRole(role.name)}
                                  disabled={roleSaving}
                                >
                                  Sil
                                </Button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Kullanici Rol Atamalari</CardTitle>
          <CardDescription>
            Kullanici bazinda rol, grup ve izin guncelleyin.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading && users.length === 0 ? (
            <div className="loading-state">Kullanicilar yukleniyor...</div>
          ) : users.length === 0 ? (
            <p>Kullanici bulunmuyor.</p>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Kullanici</th>
                    <th>Rol</th>
                    <th>Ek Roller</th>
                    <th>Gruplar</th>
                    <th>Izinler</th>
                    <th>Durum</th>
                    <th>Islem</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => {
                    const saving = userSaving[user.id];
                    return (
                      <tr key={user.id}>
                        <td>
                          <div className="cell-title">{user.full_name || user.username}</div>
                          <div className="cell-muted">{user.email}</div>
                        </td>
                        <td>
                          <Select
                            value={user.role || ""}
                            onChange={(event) =>
                              handleUpdateUser(user.id, { role: event.target.value })
                            }
                            disabled={saving}
                          >
                            <SelectOption value="">Rol secin</SelectOption>
                            {roleNames.map((role) => (
                              <SelectOption key={role} value={role}>
                                {role}
                              </SelectOption>
                            ))}
                          </Select>
                        </td>
                        <td>
                          <Textarea
                            rows={2}
                            value={toListString(user.roles)}
                            onBlur={(event) =>
                              handleUpdateUser(user.id, {
                                roles: event.target.value
                                  .split(",")
                                  .map((item) => item.trim())
                                  .filter(Boolean),
                              })
                            }
                            placeholder="virgul ile roller"
                            disabled={saving}
                          />
                        </td>
                        <td>
                          <Textarea
                            rows={2}
                            value={toListString(user.groups)}
                            onBlur={(event) =>
                              handleUpdateUser(user.id, {
                                groups: event.target.value
                                  .split(",")
                                  .map((item) => item.trim())
                                  .filter(Boolean),
                              })
                            }
                            placeholder="virgul ile gruplar"
                            disabled={saving}
                          />
                        </td>
                        <td>
                          <Textarea
                            rows={2}
                            value={toListString(user.permissions)}
                            onBlur={(event) =>
                              handleUpdateUser(user.id, {
                                permissions: event.target.value
                                  .split(",")
                                  .map((item) => item.trim())
                                  .filter(Boolean),
                              })
                            }
                            placeholder="virgul ile izinler"
                            disabled={saving}
                          />
                        </td>
                        <td>
                          <Select
                            value={user.is_active ? "active" : "inactive"}
                            onChange={(event) =>
                              handleUpdateUser(user.id, {
                                is_active: event.target.value === "active",
                              })
                            }
                            disabled={saving}
                          >
                            <SelectOption value="active">Aktif</SelectOption>
                            <SelectOption value="inactive">Pasif</SelectOption>
                          </Select>
                        </td>
                        <td>
                          {saving ? <span>Kaydediliyor...</span> : <span>Hazir</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminConfigModule;
