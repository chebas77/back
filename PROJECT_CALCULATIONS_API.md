# API de Gestión de Proyectos y Cálculos

## Resumen de Mejoras

Se ha mejorado la relación entre proyectos y cálculos (alignment_reports) para permitir que **un proyecto tenga múltiples cálculos** asignados. 

## Nuevas Funcionalidades

### 1. Gestión de Proyectos

#### Crear Proyecto
```http
POST /api/projects
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Proyecto Planta Industrial",
  "description": "Alineamiento de maquinaria zona A"
}
```

#### Actualizar Proyecto
```http
PUT /api/projects/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Proyecto Actualizado",
  "description": "Nueva descripción",
  "status": "COMPLETADO"
}
```

#### Eliminar Proyecto
```http
DELETE /api/projects/:id
Authorization: Bearer <token>
```
**Nota:** Al eliminar un proyecto, todos los cálculos asociados se desasignan automáticamente (no se eliminan).

#### Listar Proyectos
```http
GET /api/projects?page=1&pageSize=20
Authorization: Bearer <token>
```

#### Buscar Proyectos
```http
GET /api/projects/search?q=industrial&limit=10
Authorization: Bearer <token>
```

---

### 2. Gestión de Cálculos en Proyectos

#### Obtener Cálculos de un Proyecto
```http
GET /api/projects/:id/calculations
Authorization: Bearer <token>
```

**Respuesta:**
```json
{
  "ok": true,
  "project": {
    "id": 5,
    "name": "Proyecto Industrial",
    "description": "...",
    "status": "EN_PROGRESO"
  },
  "calculations": [
    {
      "id": 123,
      "title": "Cálculo Motor 1",
      "equipment_id": "MOT-001",
      "method": "RIM_FACE",
      "created_at": "2025-12-15T10:30:00.000Z"
    },
    {
      "id": 124,
      "title": "Cálculo Motor 2",
      "equipment_id": "MOT-002",
      "method": "RIM_FACE",
      "created_at": "2025-12-15T11:45:00.000Z"
    }
  ]
}
```

#### Obtener Reportes Detallados de un Proyecto
```http
GET /api/projects/:projectId/alignment-reports?page=1&pageSize=20
Authorization: Bearer <token>
```

---

### 3. Asignar/Desasignar Cálculos

#### Crear Cálculo y Asignarlo a un Proyecto
```http
POST /api/reports
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "Cálculo Bomba Principal",
  "description": "Alineamiento inicial",
  "equipmentId": "PUMP-001",
  "projectId": 5,
  "dims": {
    "H": 100,
    "D": 50,
    "E": 25
  },
  "indicators": { ... },
  "results": { ... },
  "sag": 0.05
}
```

#### Asignar un Cálculo Existente a un Proyecto
```http
PUT /api/reports/:reportId/assign-project
Authorization: Bearer <token>
Content-Type: application/json

{
  "projectId": 5
}
```

**Ejemplo:**
```bash
curl -X PUT http://localhost:4000/api/reports/123/assign-project \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"projectId": 5}'
```

#### Desasignar un Cálculo de un Proyecto
```http
PUT /api/reports/:reportId/unassign-project
Authorization: Bearer <token>
```

**Ejemplo:**
```bash
curl -X PUT http://localhost:4000/api/reports/123/unassign-project \
  -H "Authorization: Bearer <token>"
```

---

### 4. Actualización de Métricas

#### Actualizar Métricas de un Proyecto
```http
POST /api/projects/:id/update-metrics
Authorization: Bearer <token>
```

Este endpoint recalcula automáticamente:
- Total de cálculos asignados
- Fecha del último cálculo
- Actualiza `updated_at` del proyecto

**Nota:** Las métricas se actualizan automáticamente al:
- Crear un nuevo cálculo con `projectId`
- Asignar un cálculo a un proyecto
- Desasignar un cálculo de un proyecto

---

## Flujo de Trabajo Típico

### Escenario 1: Crear Proyecto y Agregar Cálculos

```javascript
// 1. Crear el proyecto
const project = await fetch('/api/projects', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'Proyecto Planta Norte',
    description: 'Mantenimiento preventivo Q4 2025'
  })
}).then(r => r.json());

const projectId = project.project.id;

// 2. Crear múltiples cálculos asignados al proyecto
for (const equipment of ['MOT-001', 'MOT-002', 'MOT-003']) {
  await fetch('/api/reports', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: `Alineamiento ${equipment}`,
      equipmentId: equipment,
      projectId: projectId,
      dims: { H: 100, D: 50, E: 25 },
      indicators: { /* ... */ },
      results: { /* ... */ },
      sag: 0
    })
  });
}

// 3. Ver todos los cálculos del proyecto
const calculations = await fetch(`/api/projects/${projectId}/calculations`, {
  headers: { 'Authorization': `Bearer ${token}` }
}).then(r => r.json());
```

### Escenario 2: Asignar Cálculos Existentes a un Proyecto

```javascript
// 1. Obtener cálculos sin proyecto
const reports = await fetch('/api/projects/null/alignment-reports', {
  headers: { 'Authorization': `Bearer ${token}` }
}).then(r => r.json());

// 2. Asignar cálculos seleccionados al proyecto
const projectId = 5;
for (const report of reports.reports) {
  await fetch(`/api/reports/${report.id}/assign-project`, {
    method: 'PUT',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectId })
  });
}
```

---

## Modelo de Datos

### Tabla `projects`
```sql
CREATE TABLE projects (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(50) DEFAULT 'NEW',
  last_calculation_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### Tabla `alignment_reports`
```sql
CREATE TABLE alignment_reports (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  project_id INT NULL,  -- ← Relación con proyectos
  method VARCHAR(50),
  title VARCHAR(255),
  description TEXT,
  equipment_id VARCHAR(100),
  dims JSON,
  indicators JSON,
  results JSON,
  sag DECIMAL(10, 6),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
);
```

---

## Funciones del Modelo

### `project.model.js`

- `getProjectCalculations(projectId)` - Obtiene todos los cálculos de un proyecto
- `assignCalculationToProject(calculationId, projectId)` - Asigna un cálculo a un proyecto
- `unassignCalculationFromProject(calculationId)` - Desasigna un cálculo de su proyecto
- `updateProjectMetrics(projectId)` - Recalcula las métricas del proyecto
- `updateProject(projectId, data)` - Actualiza nombre, descripción o estado
- `deleteProject(projectId)` - Elimina el proyecto (desasigna cálculos primero)

---

## Notas Importantes

1. **Un cálculo puede pertenecer a un solo proyecto a la vez** (relación 1:N)
2. **Los cálculos sin proyecto tienen `project_id = NULL`**
3. **Al eliminar un proyecto, los cálculos se desasignan pero no se eliminan**
4. **Las métricas se actualizan automáticamente** al modificar asignaciones
5. **Se puede obtener cálculos sin proyecto** con `/api/projects/null/alignment-reports`
