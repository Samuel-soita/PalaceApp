import { Box, Skeleton, Container, Grid } from '@mui/material';

/**
 * GlobalSkeleton
 * Matches DashboardLayout structure to eliminate layout shift during route transitions.
 */
export const GlobalSkeleton = () => (
    <Box sx={{ p: { xs: 2, md: 4 } }}>
        <Container maxWidth="xl">
            <Box sx={{ mb: 4 }}>
                <Skeleton variant="text" width="40%" height={60} sx={{ bgcolor: 'rgba(255,255,255,0.05)' }} />
                <Skeleton variant="text" width="20%" height={30} sx={{ bgcolor: 'rgba(255,255,255,0.03)' }} />
            </Box>

            <Grid container spacing={3} sx={{ mb: 4 }}>
                {[1, 2, 3, 4].map((i) => (
                    <Grid item xs={12} sm={6} md={3} key={i}>
                        <Skeleton 
                            variant="rectangular" 
                            height={120} 
                            sx={{ bgcolor: 'rgba(255,255,255,0.05)', borderRadius: 0 }} 
                        />
                    </Grid>
                ))}
            </Grid>

            <Skeleton 
                variant="rectangular" 
                height={400} 
                sx={{ bgcolor: 'rgba(255,255,255,0.03)', borderRadius: 0 }} 
            />
        </Container>
    </Box>
);
