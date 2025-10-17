/**
 * Role Helper Functions
 * Matches web app's roleHelper.js
 */

import firestore from '@react-native-firebase/firestore';

/**
 * Check if user is SuperAdmin
 */
export function isSuperAdmin(userData) {
  if (!userData) return false;
  return userData.globalRole === 'superadmin';
}

/**
 * Check if user is Project Admin for a specific project
 */
export function isProjectAdmin(userData, projectId) {
  if (!userData || !projectId) return false;

  // SuperAdmin is admin of all projects
  if (isSuperAdmin(userData)) return true;

  // Check if user has project_admin role for this project
  const userProjects = userData.userProjects || [];
  const project = userProjects.find(p => p.projectId === projectId);
  return project && project.role === 'project_admin';
}

/**
 * Get all projects for a user with their roles
 */
export async function getUserProjects(userId) {
  if (!userId) return [];

  try {
    const userProjectsSnapshot = await firestore()
      .collection('userProjects')
      .where('userId', '==', userId)
      .where('isActive', '==', true)
      .get();

    const projects = [];

    for (const doc of userProjectsSnapshot.docs) {
      const userProjectData = doc.data();

      // Fetch project details
      const projectDoc = await firestore()
        .collection('projects')
        .doc(userProjectData.projectId)
        .get();

      if (projectDoc.exists && projectDoc.data().isActive) {
        projects.push({
          id: projectDoc.id,
          ...projectDoc.data(),
          userRole: userProjectData.role, // user or project_admin
          addedAt: userProjectData.addedAt,
        });
      }
    }

    // Sort by project name
    projects.sort((a, b) => a.name.localeCompare(b.name));

    return projects;
  } catch (error) {
    console.error('Error fetching user projects:', error);
    return [];
  }
}

/**
 * Get user's role in a specific project
 */
export async function getUserRoleInProject(userId, projectId) {
  if (!userId || !projectId) return null;

  try {
    const snapshot = await firestore()
      .collection('userProjects')
      .where('userId', '==', userId)
      .where('projectId', '==', projectId)
      .where('isActive', '==', true)
      .get();

    if (snapshot.empty) return null;

    return snapshot.docs[0].data().role;
  } catch (error) {
    console.error('Error fetching user role:', error);
    return null;
  }
}

/**
 * Check if user has access to a project
 */
export async function hasAccessToProject(userId, projectId, userData = null) {
  if (!userId || !projectId) return false;

  // SuperAdmin has access to all projects
  if (userData && isSuperAdmin(userData)) return true;

  try {
    const snapshot = await firestore()
      .collection('userProjects')
      .where('userId', '==', userId)
      .where('projectId', '==', projectId)
      .where('isActive', '==', true)
      .get();

    return !snapshot.empty;
  } catch (error) {
    console.error('Error checking project access:', error);
    return false;
  }
}
