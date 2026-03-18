export const isUserManagingDepartment = (user: any, targetDepartmentId: string): boolean => {
    if (!user) return false;
    
    // Global access
    if (['WATUA', 'SUPER_ADMIN', 'SYSTEM_ADMIN', 'SECRETARY'].includes(user.role)) {
        return true;
    }

    // Direct department mapping
    if (user.departmentId === targetDepartmentId) return true;

    // Many-to-many managed departments mapping
    if (user.managedDepartments && Array.isArray(user.managedDepartments)) {
        return user.managedDepartments.some((d: any) => String(d.id) === String(targetDepartmentId));
    }

    return false;
};

export const getUserManagedDepartmentIds = (user: any): string[] => {
    if (!user) return [];
    
    const ids = new Set<string>();
    if (user.departmentId) ids.add(user.departmentId);
    
    if (user.managedDepartments && Array.isArray(user.managedDepartments)) {
        user.managedDepartments.forEach((d: any) => ids.add(d.id));
    }
    
    return Array.from(ids);
};
