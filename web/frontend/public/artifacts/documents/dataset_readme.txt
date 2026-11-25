This directory contains the provenance logs generated using the SPADE and based on the system logs collected by Auditd on Ubuntu VM1. 
The files have all the provenance nodes and edges.

The "Phase1_Provenance.csv" is the provenance log generated during the first phase (benign) of the experiment.
The "Phase2_Provenance.csv" is the provenance log generated during the second phase (attack scenario) of the experiment.


The list of the provenance files features are:

['id', 'type', 'from', 'to', 'uid', 'egid', 'exe', 'gid', 'euid', 'name',
       'pid', 'seen time', 'source', 'ppid', 'command line', 'start time',
       'event id', 'time', 'operation', 'path', 'subtype', 'permissions',
       'epoch', 'version', 'flags', 'local address', 'remote port', 'protocol',
       'remote address', 'local port', 'tgid', 'fd', 'mode', 'label',
       'subLabel']