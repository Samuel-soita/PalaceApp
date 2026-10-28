import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Alert, Box, Button, Typography } from '@mui/material';

interface Props {
    children: ReactNode;
}

interface State {
    error: Error | null;
}

/** Contains a crash to the current page so the rest of the app stays usable. */
export default class RouteErrorBoundary extends Component<Props, State> {
    state: State = { error: null };

    static getDerivedStateFromError(error: Error): State {
        return { error };
    }

    componentDidCatch(error: Error, info: ErrorInfo) {
        console.error('[RouteErrorBoundary]', error, info.componentStack);
    }

    render() {
        if (!this.state.error) return this.props.children;
        return (
            <Box sx={{ p: 4, maxWidth: 640, mx: 'auto' }}>
                <Alert severity="error" sx={{ mb: 2 }}>
                    <Typography fontWeight={700}>This section failed to load.</Typography>
                    <Typography variant="body2" sx={{ opacity: 0.8, mt: 0.5 }}>
                        {this.state.error.message || this.state.error.name}
                    </Typography>
                </Alert>
                <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button variant="contained" onClick={() => this.setState({ error: null })}>Try again</Button>
                    <Button variant="outlined" onClick={() => window.location.reload()}>Reload page</Button>
                </Box>
            </Box>
        );
    }
}
