import { Box, Typography, LinearProgress, Paper, Chip } from '@mui/material';
import { Briefcase, Clock } from 'lucide-react';

interface Project {
    id: string;
    title: string;
    description: string;
    status: string;
    progress: number;
    deadline: string;
    department: { name: string };
    budget: number;
}

export const ProjectOverview = ({ projects }: { projects: Project[] }) => {
    return (
        <Box display="flex" flexDirection="column" gap={3}>
            {projects.map((project) => (
                <Paper key={project.id} elevation={0} className="tactical-border" sx={{ p: 3, bgcolor: 'rgba(255,255,255,0.03)', borderRadius: 2 }}>
                    <Box display="flex" justifyContent="space-between" alignItems="start" mb={2}>
                        <Box>
                            <Typography variant="h6" fontWeight="800" sx={{ lineHeight: 1.2 }}>{project.title}</Typography>
                            <Box display="flex" alignItems="center" gap={2} mt={0.5}>
                                <Typography variant="caption" className="neon-label" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                    <Briefcase size={12} /> {project.department.name}
                                </Typography>
                                {project.deadline && (
                                    <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, opacity: 0.6, color: 'secondary.main', fontWeight: 'bold' }}>
                                        <Clock size={12} /> {new Date(project.deadline).toLocaleDateString()}
                                    </Typography>
                                )}
                            </Box>
                        </Box>
                        <Chip 
                            label={project.status} 
                            size="small" 
                            className={`status-chip-${project.status.toLowerCase()}`}
                            sx={{ fontWeight: 900, fontSize: '0.65rem' }} 
                        />
                    </Box>
                    <Box mt={3}>
                        <Box display="flex" justifyContent="space-between" mb={1}>
                            <Typography variant="caption" sx={{ fontWeight: 700, opacity: 0.6 }}>Progress</Typography>
                            <Typography variant="caption" sx={{ fontWeight: 900, color: 'primary.main' }}>{project.progress}%</Typography>
                        </Box>
                        <LinearProgress 
                            variant="determinate" 
                            value={project.progress} 
                            sx={{ height: 6, borderRadius: 3, bgcolor: 'rgba(255,255,255,0.05)', '& .MuiLinearProgress-bar': { borderRadius: 3 } }} 
                        />
                    </Box>
                </Paper>
            ))}
            {projects.length === 0 && (
                <Typography variant="body2" sx={{ textAlign: 'center', opacity: 0.5, py: 4 }}>No active projects found.</Typography>
            )}
        </Box>
    );
};
